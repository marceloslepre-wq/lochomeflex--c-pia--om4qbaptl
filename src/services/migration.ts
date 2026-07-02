import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pb from '@/lib/pocketbase/client'

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

export function createMigrationClient(config: MigrationConfig): SupabaseClient {
  return createClient(config.url, config.key)
}

export async function fetchSupabaseTable(config: MigrationConfig, table: string): Promise<any[]> {
  const client = createMigrationClient(config)
  const { data, error } = await client.from(table).select('*')
  if (error) throw new Error(`Erro ao buscar ${table}: ${error.message}`)
  return data || []
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

export async function previewCollection(
  config: MigrationConfig,
  collection: MigrationCollectionId,
): Promise<PreviewResult> {
  const sourceTable =
    collection === 'contracts' || collection === 'billing' ? 'rentals' : collection
  const records = await fetchSupabaseTable(config, sourceTable)

  let duplicates = 0
  const warnings: string[] = []

  if (collection === 'customers') {
    const existing = await pb.collection('customers').getFullList()
    const emails = new Set(existing.map((r: any) => r.email).filter(Boolean))
    duplicates = records.filter((r: any) => r.email && emails.has(r.email)).length
    records.forEach((r: any) => {
      if (!r.name) warnings.push(`Registro ${r.id} sem nome`)
    })
  } else if (collection === 'inventory') {
    const existing = await pb.collection('inventory').getFullList()
    const skus = new Set(existing.map((r: any) => r.sku).filter(Boolean))
    duplicates = records.filter((r: any) => r.code && skus.has(r.code)).length
    records.forEach((r: any) => {
      if (!r.name) warnings.push(`Registro ${r.id} sem nome`)
      if (r.daily_price == null) warnings.push(`Registro ${r.id} sem diária`)
    })
  } else if (collection === 'rentals') {
    duplicates = (await pb.collection('rentals').getFullList()).length
  } else if (collection === 'contracts') {
    duplicates = (await pb.collection('contracts').getFullList()).length
  } else if (collection === 'billing') {
    duplicates = (await pb.collection('billing').getFullList()).length
  }

  return {
    collection,
    totalRecords: records.length,
    newRecords: Math.max(0, records.length - duplicates),
    duplicates,
    invalid: warnings.length,
    warnings,
  }
}
