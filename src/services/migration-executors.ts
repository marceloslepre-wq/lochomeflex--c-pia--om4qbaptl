import pb from '@/lib/pocketbase/client'
import type {
  MigrationConfig,
  CollectionMigrationResult,
  ProgressCallback,
} from '@/services/migration'
import {
  fetchSupabaseTable,
  mapRentalStatus,
  mapInventoryStatus,
  mapBillingStatus,
  stringifyAddress,
} from '@/services/migration'

type R = CollectionMigrationResult

function newResult(c: string): R {
  return { collection: c, total: 0, success: 0, skipped: 0, errors: 0, errorLog: [] }
}

async function run<T>(
  records: T[],
  fn: (r: T, i: number) => Promise<'success' | 'skipped'>,
  result: R,
  onProgress?: ProgressCallback,
) {
  result.total = records.length
  for (let i = 0; i < records.length; i++) {
    try {
      const s = await fn(records[i], i)
      if (s === 'skipped') result.skipped++
      else result.success++
    } catch (e: any) {
      result.errors++
      result.errorLog.push({ index: i, record: records[i], error: e.message || String(e) })
    }
    onProgress?.(i + 1, records.length)
  }
}

export async function executeCustomersMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('customers')
  const records = await fetchSupabaseTable(config, 'customers')
  const existing = await pb.collection('customers').getFullList()
  const emails = new Set(existing.map((r: any) => r.email).filter(Boolean))
  await run(
    records,
    async (r: any) => {
      if (!r.name) throw new Error('Nome obrigatório')
      if (r.email && emails.has(r.email)) return 'skipped'
      await pb.collection('customers').create({
        name: r.name,
        email: r.email || '',
        phone: r.phone_cell || r.phone_res || r.phone_com || '',
        document_id: r.document || '',
        address: stringifyAddress(r.address),
      })
      if (r.email) emails.add(r.email)
      return 'success'
    },
    result,
    onProgress,
  )
  return result
}

export async function executeInventoryMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('inventory')
  const records = await fetchSupabaseTable(config, 'inventory')
  const existing = await pb.collection('inventory').getFullList()
  const skus = new Set(existing.map((r: any) => r.sku).filter(Boolean))
  await run(
    records,
    async (r: any) => {
      if (!r.name) throw new Error('Nome obrigatório')
      if (r.code && skus.has(r.code)) return 'skipped'
      await pb.collection('inventory').create({
        name: r.name,
        description: r.description || '',
        sku: r.code || '',
        category: r.category || '',
        daily_rate: r.daily_price || 0,
        status: mapInventoryStatus(r.condition_status),
      })
      if (r.code) skus.add(r.code)
      return 'success'
    },
    result,
    onProgress,
  )
  return result
}

export async function executeRentalsMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('rentals')
  const records = await fetchSupabaseTable(config, 'rentals')
  const sbCustomers = await fetchSupabaseTable(config, 'customers')
  const pbCustomers = await pb.collection('customers').getFullList()
  const emailToPb = new Map(pbCustomers.map((c: any) => [c.email, c.id]))
  const custMap = new Map<string, string>()
  for (const c of sbCustomers)
    if (c.email && emailToPb.has(c.email)) custMap.set(c.id, emailToPb.get(c.email)!)
  const sbInv = await fetchSupabaseTable(config, 'inventory')
  const pbInv = await pb.collection('inventory').getFullList()
  const codeToPb = new Map(pbInv.map((i: any) => [i.sku, i.id]))
  const invMap = new Map<string, string>()
  for (const inv of sbInv)
    if (inv.code && codeToPb.has(inv.code)) invMap.set(inv.id, codeToPb.get(inv.code)!)
  await run(
    records,
    async (r: any) => {
      const custPbId = r.customer_id ? custMap.get(r.customer_id) : null
      if (!custPbId) throw new Error('Cliente não encontrado no destino')
      let itemIds: string[] = []
      if (r.items) {
        const items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items
        if (Array.isArray(items)) {
          itemIds = items
            .map((it: any) => {
              const sbId = typeof it === 'string' ? it : it.id || it.inventory_id
              return sbId ? invMap.get(sbId) : null
            })
            .filter(Boolean) as string[]
        }
      }
      await pb.collection('rentals').create({
        customer: custPbId,
        items: itemIds,
        start_date: r.start_date,
        end_date: r.expected_return_date || '',
        total_price: r.total || 0,
        status: mapRentalStatus(r.status),
      })
      return 'success'
    },
    result,
    onProgress,
  )
  return result
}

export async function executeContractsMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('contracts')
  const records = await fetchSupabaseTable(config, 'rentals')
  const pbRentals = await pb.collection('rentals').getFullList()
  await run(
    records,
    async (r: any) => {
      if (!r.contract_number && !r.custom_contract_html) return 'skipped'
      const match = pbRentals.find((pr: any) => pr.start_date === r.start_date)
      if (!match) return 'skipped'
      await pb.collection('contracts').create({ rental: match.id, signed_at: r.start_date || '' })
      return 'success'
    },
    result,
    onProgress,
  )
  return result
}

export async function executeBillingMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('billing')
  const records = await fetchSupabaseTable(config, 'rentals')
  const pbRentals = await pb.collection('rentals').getFullList()
  await run(
    records,
    async (r: any) => {
      const match = pbRentals.find((pr: any) => pr.start_date === r.start_date)
      if (!match) return 'skipped'
      await pb.collection('billing').create({
        rental: match.id,
        amount: r.total || 0,
        due_date: r.expected_return_date || r.start_date,
        status: mapBillingStatus(r.status),
        payment_method: r.payment_method || '',
      })
      return 'success'
    },
    result,
    onProgress,
  )
  return result
}

export async function executeMigration(
  config: MigrationConfig,
  collection: string,
  onProgress?: ProgressCallback,
): Promise<R> {
  switch (collection) {
    case 'customers':
      return executeCustomersMigration(config, onProgress)
    case 'inventory':
      return executeInventoryMigration(config, onProgress)
    case 'rentals':
      return executeRentalsMigration(config, onProgress)
    case 'contracts':
      return executeContractsMigration(config, onProgress)
    case 'billing':
      return executeBillingMigration(config, onProgress)
    default:
      throw new Error(`Coleção desconhecida: ${collection}`)
  }
}
