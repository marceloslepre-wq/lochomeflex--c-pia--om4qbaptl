import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pb from '@/lib/pocketbase/client'

export const MIGRATION_BATCH_SIZE = 25

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const MIN_BATCH_SIZE = 5

export interface MigrationConfig {
  url: string
  key: string
  throttleDelayMs?: number
}

export interface MigrationErrorEntry {
  index: number
  record: any
  error: string
  fieldErrors?: Record<string, string>
}

export interface CollectionMigrationResult {
  collection: string
  total: number
  success: number
  skipped: number
  errors: number
  errorLog: MigrationErrorEntry[]
}

export interface PreviewResult {
  collection: string
  totalRecords: number
  newRecords: number
  duplicates: number
  invalid: number
  warnings: string[]
}

export type ProgressCallback = (current: number, total: number) => void

export const MIGRATION_COLLECTIONS = [
  { id: 'customers', label: 'Clientes', icon: 'Users', order: 1, dependsOn: [] as string[] },
  { id: 'inventory', label: 'Inventário', icon: 'Package', order: 2, dependsOn: [] as string[] },
  {
    id: 'rentals',
    label: 'Locações',
    icon: 'FileText',
    order: 3,
    dependsOn: ['customers', 'inventory'],
  },
  { id: 'contracts', label: 'Contratos', icon: 'FileSignature', order: 4, dependsOn: ['rentals'] },
  { id: 'billing', label: 'Cobranças', icon: 'Receipt', order: 5, dependsOn: ['rentals'] },
] as const

export type MigrationCollectionId = (typeof MIGRATION_COLLECTIONS)[number]['id']

export function isTimeoutError(err: any): boolean {
  const code = err?.code || err?.response?.code
  const msg = (err?.message || '').toLowerCase()
  return (
    code === '57014' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('statement timeout')
  )
}

export function isStatementTimeout(err: any): boolean {
  const code = err?.code || err?.response?.code
  return code === '57014'
}

export function createMigrationClient(config: MigrationConfig): SupabaseClient {
  return createClient(config.url, config.key)
}

function buildSupabaseHeaders(config: MigrationConfig): Record<string, string> {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
  }
}

function buildSupabaseUrl(config: MigrationConfig, table: string): string {
  const baseUrl = config.url.replace(/\/$/, '')
  return `${baseUrl}/rest/v1/${table}`
}

function parseContentRangeCount(contentRange: string | null): number {
  if (!contentRange) return 0
  const match = contentRange.match(/\/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

function safeParseJson(text: string): any[] {
  if (!text || !text.trim()) return []
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function safeJsonParse(text: string, fallback: any = null): any {
  if (!text || typeof text !== 'string' || !text.trim()) return fallback
  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('[safeJsonParse] Failed to parse JSON:', text.substring(0, 100))
    return fallback
  }
}

async function extractResponseError(
  res: Response,
): Promise<{ code: string | null; message: string }> {
  let code: string | null = null
  let message = `HTTP ${res.status} ${res.statusText}`
  try {
    const text = await res.text()
    if (text && text.trim()) {
      try {
        const body = JSON.parse(text)
        code = body?.code || null
        message = body?.message || body?.error || message
      } catch {
        if (text.toLowerCase().includes('57014') || text.toLowerCase().includes('timeout')) {
          code = '57014'
          message = text
        }
      }
    }
  } catch {
    /* response body already consumed or unreadable */
  }
  return { code, message }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) {
      const { code, message } = await extractResponseError(res)
      const error: any = new Error(message)
      if (code) error.code = code
      throw error
    }
    return res
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchSupabaseCount(config: MigrationConfig, table: string): Promise<number> {
  const url = `${buildSupabaseUrl(config, table)}?select=*`
  const headers = {
    ...buildSupabaseHeaders(config),
    Prefer: 'count=exact',
    Range: '0-0',
  }

  let lastError: any = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: 'HEAD', headers })
      const contentRange = res.headers.get('Content-Range')
      const count = parseContentRangeCount(contentRange)
      // HEAD responses have no body — Content-Range header is all we need.
      if (count === 0 && !contentRange) {
        console.warn(
          `[fetchSupabaseCount] Content-Range header missing for "${table}". ` +
            `The table may be empty or the API did not return a count.`,
        )
      }
      return count
    } catch (err: any) {
      lastError = err
      console.error(
        `[fetchSupabaseCount] Error counting "${table}" ` +
          `(attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        err.message,
      )
      if (isStatementTimeout(err) || err.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS * (attempt + 1))
          continue
        }
        throw new Error(
          `Timeout ao contar registros de "${table}". O banco de origem pode estar sobrecarregado. Tente novamente.`,
        )
      }
      throw new Error(`Erro ao contar "${table}": ${err.message}`)
    }
  }
  throw new Error(`Erro ao contar "${table}": ${lastError?.message || 'unknown'}`)
}

export async function* fetchSupabaseTableBatches(
  config: MigrationConfig,
  table: string,
  batchSize: number = MIGRATION_BATCH_SIZE,
): AsyncGenerator<{ records: any[]; batchIndex: number; totalSoFar: number }> {
  const baseUrl = buildSupabaseUrl(config, table)
  const headers = {
    ...buildSupabaseHeaders(config),
    Prefer: 'count=exact',
  }
  let from = 0
  let batchIndex = 0
  let totalSoFar = 0
  let currentBatchSize = batchSize

  while (true) {
    let records: any[] | null = null
    let lastError: any = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetchWithTimeout(`${baseUrl}?select=*`, {
          method: 'GET',
          headers: {
            ...headers,
            Range: `${from}-${from + currentBatchSize - 1}`,
          },
        })
        const text = await res.text()
        const data = safeParseJson(text)
        records = data
        break
      } catch (err: any) {
        lastError = err
        if (isStatementTimeout(err) || err.name === 'AbortError') {
          if (attempt < MAX_RETRIES) {
            if (currentBatchSize > MIN_BATCH_SIZE) {
              currentBatchSize = Math.max(MIN_BATCH_SIZE, Math.floor(currentBatchSize / 2))
            }
            await delay(RETRY_DELAY_MS * (attempt + 1))
            continue
          }
          throw new Error(
            `Timeout ao buscar "${table}" (lote ${batchIndex + 1}, registros ${from + 1}–${from + currentBatchSize}). ` +
              `O banco de origem demorou demais. Tente novamente ou reduza o tamanho do lote.`,
          )
        }
        if (isTimeoutError(err)) {
          if (attempt < MAX_RETRIES) {
            await delay(RETRY_DELAY_MS * (attempt + 1))
            continue
          }
          throw new Error(
            `Timeout ao buscar "${table}" (lote ${batchIndex + 1}, registros ${from + 1}–${from + currentBatchSize}). ` +
              `O banco de origem demorou demais. Tente novamente ou reduza o tamanho do lote.`,
          )
        }
        throw new Error(`Erro ao buscar "${table}": ${err.message}`)
      }
    }

    if (records === null) {
      throw new Error(`Erro ao buscar "${table}": ${lastError?.message || 'unknown'}`)
    }
    if (records.length === 0) break

    totalSoFar += records.length
    yield { records, batchIndex, totalSoFar }

    if (records.length < currentBatchSize) break
    from += currentBatchSize
    batchIndex++
  }
}

export async function fetchSupabaseTable(config: MigrationConfig, table: string): Promise<any[]> {
  const allRecords: any[] = []
  for await (const { records } of fetchSupabaseTableBatches(config, table)) {
    allRecords.push(...records)
  }
  return allRecords
}

export function mapRentalStatus(status: string): string {
  const s = (status || '').toLowerCase()
  const map: Record<string, string> = {
    ativo: 'active',
    ativa: 'active',
    concluido: 'completed',
    finalizado: 'completed',
    cancelado: 'cancelled',
    pendente: 'pending',
    atrasado: 'active',
  }
  return map[s] || 'pending'
}

export function mapInventoryStatus(status: string): string {
  const s = (status || '').toLowerCase()
  const map: Record<string, string> = {
    disponivel: 'available',
    available: 'available',
    locado: 'rented',
    rented: 'rented',
    alugado: 'rented',
    manutencao: 'maintenance',
    maintenance: 'maintenance',
    perdido: 'lost',
    lost: 'lost',
  }
  return map[s] || 'available'
}

export function mapBillingStatus(rentalStatus: string): string {
  return mapRentalStatus(rentalStatus) === 'completed' ? 'paid' : 'unpaid'
}

export function stringifyAddress(addr: any): string {
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') {
    return [addr.street, addr.number, addr.neighborhood, addr.city, addr.state, addr.zipCode]
      .filter(Boolean)
      .join(', ')
  }
  return String(addr)
}

export function consolidatePhone(r: any): string {
  return r.phone_cell || r.phone_res || r.phone_com || r.phone || ''
}

const MAX_WARNINGS = 50

export async function previewCollection(
  config: MigrationConfig,
  collection: MigrationCollectionId,
): Promise<PreviewResult> {
  const sourceTable =
    collection === 'contracts' || collection === 'billing' ? 'rentals' : collection

  let totalRecords = 0
  try {
    totalRecords = await fetchSupabaseCount(config, sourceTable)
  } catch (err: any) {
    return {
      collection,
      totalRecords: 0,
      newRecords: 0,
      duplicates: 0,
      invalid: 0,
      warnings: [
        isTimeoutError(err)
          ? `Timeout ao contar registros: ${err.message}`
          : `Erro ao contar registros: ${err.message}`,
      ],
    }
  }

  let duplicates = 0
  let invalid = 0
  const warnings: string[] = []

  try {
    if (collection === 'customers') {
      const existing = await pb.collection('customers').getFullList()
      const emails = new Set(existing.map((r: any) => r.email).filter(Boolean))
      for await (const { records } of fetchSupabaseTableBatches(config, sourceTable)) {
        for (const r of records) {
          if (r.email && emails.has(r.email)) duplicates++
          if (warnings.length < MAX_WARNINGS && !r.name) {
            invalid++
            warnings.push(`Registro ${r.id || '?'} sem nome`)
          }
        }
      }
    } else if (collection === 'inventory') {
      const existing = await pb.collection('inventory').getFullList()
      const skus = new Set(existing.map((r: any) => r.sku).filter(Boolean))
      for await (const { records } of fetchSupabaseTableBatches(config, sourceTable)) {
        for (const r of records) {
          if (r.code && skus.has(r.code)) duplicates++
          if (warnings.length < MAX_WARNINGS) {
            if (!r.name) {
              invalid++
              warnings.push(`Registro ${r.id || '?'} sem nome`)
            }
            if (r.daily_price == null) {
              invalid++
              warnings.push(`Registro ${r.id || '?'} sem diária`)
            }
          }
        }
      }
    } else if (collection === 'rentals' || collection === 'contracts' || collection === 'billing') {
      duplicates = (await pb.collection(collection).getFullList()).length
    }
  } catch (err: any) {
    if (warnings.length < MAX_WARNINGS) {
      warnings.push(
        isTimeoutError(err)
          ? `Timeout ao buscar registros: ${err.message}`
          : `Erro ao buscar registros: ${err.message}`,
      )
    }
  }

  return {
    collection,
    totalRecords,
    newRecords: Math.max(0, totalRecords - duplicates),
    duplicates,
    invalid,
    warnings,
  }
}
