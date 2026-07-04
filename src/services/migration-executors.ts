import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import type {
  MigrationConfig,
  CollectionMigrationResult,
  MigrationErrorEntry,
  ProgressCallback,
} from '@/services/migration'
import {
  fetchSupabaseTableBatches,
  fetchSupabaseTable,
  fetchSupabaseCount,
  mapRentalStatus,
  mapInventoryStatus,
  mapBillingStatus,
  stringifyAddress,
  consolidatePhone,
  safeJsonParse,
  parseAddressParts,
} from '@/services/migration'

type R = CollectionMigrationResult

function newResult(c: string): R {
  return { collection: c, total: 0, success: 0, skipped: 0, errors: 0, errorLog: [] }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runBatch<T>(
  records: T[],
  fn: (r: T, i: number) => Promise<'success' | 'skipped'>,
  result: R,
  offset: number,
  total: number,
  onProgress?: ProgressCallback,
  throttleMs?: number,
) {
  for (let i = 0; i < records.length; i++) {
    try {
      const s = await fn(records[i], i)
      if (s === 'skipped') result.skipped++
      else result.success++
    } catch (e: any) {
      result.errors++
      console.error(
        `[runBatch] Error processing record at index ${offset + i} in "${result.collection}":`,
        e instanceof Error ? e.message : e,
      )
      const fieldErrors = extractFieldErrors(e)
      const entry: MigrationErrorEntry = {
        index: offset + i,
        record: records[i],
        error: getErrorMessage(e),
        fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      }
      result.errorLog.push(entry)
    }
    onProgress?.(offset + i + 1, total)
    if (throttleMs && throttleMs > 0 && i < records.length - 1) {
      await delay(throttleMs)
    }
  }
}

export async function executeCustomersMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('customers')
  const total = await fetchSupabaseCount(config, 'customers')
  result.total = total
  const existing = await pb.collection('customers').getFullList()
  const emailToPb = new Map(existing.filter((r: any) => r.email).map((r: any) => [r.email, r.id]))
  const docToPb = new Map(
    existing.filter((r: any) => r.document_id).map((r: any) => [r.document_id, r.id]),
  )

  let offset = 0
  for await (const { records } of fetchSupabaseTableBatches(config, 'customers')) {
    await runBatch(
      records,
      async (r: any) => {
        if (!r.name) throw new Error('Nome obrigatório')
        const payload = {
          name: r.name,
          email: r.email || '',
          phone: consolidatePhone(r),
          document_id: r.document || '',
          address: stringifyAddress(r.address),
        }
        const existingByEmail = r.email ? emailToPb.get(r.email) : null
        const existingByDoc = r.document ? docToPb.get(r.document) : null
        const existingId = existingByEmail || existingByDoc
        if (existingId) {
          await pb.collection('customers').update(existingId, payload)
        } else {
          const created = await pb.collection('customers').create(payload)
          if (r.email) emailToPb.set(r.email, created.id)
          if (r.document) docToPb.set(r.document, created.id)
        }
        return 'success'
      },
      result,
      offset,
      total,
      onProgress,
      config.throttleDelayMs,
    )
    offset += records.length
  }
  return result
}

export async function executeInventoryMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('inventory')
  const total = await fetchSupabaseCount(config, 'inventory')
  result.total = total
  const existing = await pb.collection('inventory').getFullList()
  const skuToPb = new Map(existing.filter((r: any) => r.sku).map((r: any) => [r.sku, r.id]))

  let offset = 0
  for await (const { records } of fetchSupabaseTableBatches(config, 'inventory')) {
    await runBatch(
      records,
      async (r: any) => {
        if (!r.name) throw new Error('Nome obrigatório')
        const payload = {
          name: r.name,
          description: r.description || '',
          sku: r.code || '',
          category: r.category || '',
          daily_rate: r.daily_price ?? 0,
          status: mapInventoryStatus(r.condition_status),
        }
        const existingId = r.code ? skuToPb.get(r.code) : null
        if (existingId) {
          await pb.collection('inventory').update(existingId, payload)
        } else {
          const created = await pb.collection('inventory').create(payload)
          if (r.code) skuToPb.set(r.code, created.id)
        }
        return 'success'
      },
      result,
      offset,
      total,
      onProgress,
      config.throttleDelayMs,
    )
    offset += records.length
  }
  return result
}

export async function executeLocationsMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('locations')

  let locaisRecords: any[] = []
  try {
    for await (const { records } of fetchSupabaseTableBatches(config, 'locais')) {
      locaisRecords.push(...records)
    }
  } catch {
    /* locais table may not exist */
  }

  let settingsLocations: any[] = []
  try {
    const settingsRecords = await fetchSupabaseTable(config, 'settings')
    for (const s of settingsRecords) {
      if (s.locations) {
        const locs = typeof s.locations === 'string' ? safeJsonParse(s.locations, []) : s.locations
        if (Array.isArray(locs)) settingsLocations.push(...locs)
      }
    }
  } catch {
    /* settings table may not exist */
  }

  const merged = new Map<string, any>()
  for (const r of locaisRecords) {
    const name = (r.nome || r.name || '').trim()
    if (name) merged.set(name, { name, ativo: r.ativo, _address: r.address || '' })
  }
  for (const sl of settingsLocations) {
    const name = (sl.name || sl.nome || '').trim()
    if (!name) continue
    const ex = merged.get(name)
    if (ex) {
      if (sl.address && !ex._address) ex._address = sl.address
    } else {
      merged.set(name, { name, ativo: true, _address: sl.address || '' })
    }
  }

  const allRecords = Array.from(merged.values())
  result.total = allRecords.length

  const existingPb = await pb.collection('locations').getFullList()
  const pbByName = new Map(existingPb.map((r: any) => [r.name, r]))

  await runBatch(
    allRecords,
    async (r: any) => {
      const name = r.name
      if (!name) throw new Error('Nome obrigatório')
      const parsed = parseAddressParts(r._address || '')
      const payload = {
        name,
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zip_code: parsed.zip_code,
        active: r.ativo !== false,
      }
      const existing = pbByName.get(name)
      if (existing) {
        await pb.collection('locations').update(existing.id, payload)
      } else {
        await pb.collection('locations').create(payload)
      }
      return 'success'
    },
    result,
    0,
    allRecords.length,
    onProgress,
    config.throttleDelayMs,
  )

  return result
}

export async function executeRentalsMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('rentals')
  const total = await fetchSupabaseCount(config, 'rentals')
  result.total = total

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

  const existingRentals = await pb.collection('rentals').getFullList()
  const existingRentalKeys = new Set(
    existingRentals.map((r: any) => `${r.customer}:${r.start_date}`),
  )

  let offset = 0
  for await (const { records } of fetchSupabaseTableBatches(config, 'rentals')) {
    await runBatch(
      records,
      async (r: any) => {
        const custPbId = r.customer_id ? custMap.get(r.customer_id) : null
        if (!custPbId) throw new Error('Cliente não encontrado no destino')
        const rentalKey = `${custPbId}:${r.start_date}`
        if (existingRentalKeys.has(rentalKey)) return 'skipped'
        let itemIds: string[] = []
        if (r.items) {
          const items = typeof r.items === 'string' ? safeJsonParse(r.items, []) : r.items
          if (Array.isArray(items)) {
            itemIds = items
              .map((it: any) => {
                const sbId = typeof it === 'string' ? it : it.id || it.inventory_id
                return sbId ? invMap.get(sbId) : null
              })
              .filter(Boolean) as string[]
          }
        }
        const created = await pb.collection('rentals').create({
          customer: custPbId,
          items: itemIds,
          start_date: r.start_date,
          end_date: r.expected_return_date || '',
          total_price: r.total || 0,
          status: mapRentalStatus(r.status),
        })
        existingRentalKeys.add(rentalKey)
        return 'success'
      },
      result,
      offset,
      total,
      onProgress,
      config.throttleDelayMs,
    )
    offset += records.length
  }
  return result
}

export async function executeContractsMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('contracts')
  const total = await fetchSupabaseCount(config, 'rentals')
  result.total = total
  const pbRentals = await pb.collection('rentals').getFullList()
  const existingContracts = await pb.collection('contracts').getFullList()
  const contractRentalIds = new Set(existingContracts.map((c: any) => c.rental))

  let offset = 0
  for await (const { records } of fetchSupabaseTableBatches(config, 'rentals')) {
    await runBatch(
      records,
      async (r: any) => {
        if (!r.contract_number && !r.custom_contract_html) return 'skipped'
        const match = pbRentals.find((pr: any) => pr.start_date === r.start_date)
        if (!match) return 'skipped'
        if (contractRentalIds.has(match.id)) return 'skipped'
        await pb.collection('contracts').create({ rental: match.id, signed_at: r.start_date || '' })
        contractRentalIds.add(match.id)
        return 'success'
      },
      result,
      offset,
      total,
      onProgress,
      config.throttleDelayMs,
    )
    offset += records.length
  }
  return result
}

export async function executeBillingMigration(
  config: MigrationConfig,
  onProgress?: ProgressCallback,
): Promise<R> {
  const result = newResult('billing')
  const total = await fetchSupabaseCount(config, 'rentals')
  result.total = total
  const pbRentals = await pb.collection('rentals').getFullList()
  const existingBilling = await pb.collection('billing').getFullList()
  const billingRentalIds = new Set(existingBilling.map((b: any) => b.rental))

  let offset = 0
  for await (const { records } of fetchSupabaseTableBatches(config, 'rentals')) {
    await runBatch(
      records,
      async (r: any) => {
        const match = pbRentals.find((pr: any) => pr.start_date === r.start_date)
        if (!match) return 'skipped'
        if (billingRentalIds.has(match.id)) return 'skipped'
        await pb.collection('billing').create({
          rental: match.id,
          amount: r.total || 0,
          due_date: r.expected_return_date || r.start_date,
          status: mapBillingStatus(r.status),
          payment_method: r.payment_method || '',
        })
        billingRentalIds.add(match.id)
        return 'success'
      },
      result,
      offset,
      total,
      onProgress,
      config.throttleDelayMs,
    )
    offset += records.length
  }
  return result
}

export async function executeMigration(
  config: MigrationConfig,
  collection: string,
  onProgress?: ProgressCallback,
): Promise<R> {
  const url = (config.url || '').trim()
  const key = (config.key || '').trim()
  if (!url || !key) {
    throw new Error('Configuração do Supabase incompleta. Verifique a URL e a chave de acesso.')
  }
  const sanitizedConfig: MigrationConfig = { ...config, url, key }
  switch (collection) {
    case 'customers':
      return executeCustomersMigration(sanitizedConfig, onProgress)
    case 'inventory':
      return executeInventoryMigration(sanitizedConfig, onProgress)
    case 'locations':
      return executeLocationsMigration(sanitizedConfig, onProgress)
    case 'rentals':
      return executeRentalsMigration(sanitizedConfig, onProgress)
    case 'contracts':
      return executeContractsMigration(sanitizedConfig, onProgress)
    case 'billing':
      return executeBillingMigration(sanitizedConfig, onProgress)
    default:
      throw new Error(`Coleção desconhecida: ${collection}`)
  }
}
