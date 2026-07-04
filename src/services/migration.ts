import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pb from '@/lib/pocketbase/client'

export const MIGRATION_BATCH_SIZE = 100

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchSupabaseCount(config: MigrationConfig, table: string): Promise<number> {
  const url = `${buildSupabaseUrl(config, table)}?select=*`
  const headers = {
    ...buildSupabaseHeaders(config),
    Prefer: 'count=exact',
  }
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD', headers })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    return parseContentRangeCount(res.headers.get('Content-Range'))
  } catch (err: any) {
    if (err.name === 'AbortError' || isTimeoutError(err)) {
      throw new Error(
        `Timeout ao contar registros de "${table}". O banco de origem pode estar sobrecarregado. Tente novamente.`,
      )
    }
    throw new Error(`Erro ao contar "${table}": ${err.message}`)
  }
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

  while (true) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}?select=*`, {
        method: 'GET',
        headers: {
          ...headers,
          Range: `${from}-${from + batchSize - 1}`,
        },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      const text = await res.text()
      const data = safeParseJson(text)
      if (data.length === 0) break

      totalSoFar += data.length
      yield { records: data, batchIndex, totalSoFar }

      if (data.length < batchSize) break
      from += batchSize
      batchIndex++
    } catch (err: any) {
      if (err.name === 'AbortError' || isTimeoutError(err)) {
        throw new Error(
          `Timeout ao buscar "${table}" (lote ${batchIndex + 1}, registros ${from + 1}–${from + batchSize}). ` +
            `O banco de origem demorou demais. Tente novamente ou reduza o tamanho do lote.`,
        )
      }
      throw new Error(`Erro ao buscar "${table}": ${err.message}`)
    }
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

  const totalRecords = await fetchSupabaseCount(config, sourceTable)

  let duplicates = 0
  let invalid = 0
  const warnings: string[] = []

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

  return {
    collection,
    totalRecords,
    newRecords: Math.max(0, totalRecords - duplicates),
    duplicates,
    invalid,
    warnings,
  }
}
