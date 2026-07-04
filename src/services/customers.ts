import pb from '@/lib/pocketbase/client'
import type { Address } from '@/stores/main'

export interface CustomerDocument {
  name: string
  url: string
  date: string
  path: string
}

export interface Customer {
  id: string
  matricula: string
  name: string
  document: string
  phoneRes?: string
  phoneCell?: string
  phoneCom?: string
  phone?: string
  email?: string
  address?: Address
  hasDifferentDeliveryAddress?: boolean
  deliveryAddress?: Address
  observations?: string
  documento_url?: CustomerDocument[]
  docIdentificacaoPath?: string | null
  comprovanteEnderecoPath?: string | null
}

const ensureClient = () => {
  if (!pb) {
    throw new Error('PocketBase client is not initialized')
  }
  return pb
}

const mapFromPb = (record: any): Customer => ({
  id: record.id,
  matricula: record.id.slice(-6),
  name: record.name || '',
  document: record.document_id || '',
  phone: record.phone || '',
  phoneCell: record.phone || '',
  phoneRes: record.phone || '',
  email: record.email || '',
  address: record.address as any,
  documento_url: [],
})

const mapToPb = (customer: Partial<Customer>): Record<string, any> => {
  const data: Record<string, any> = {}
  if (customer.name !== undefined) data.name = customer.name
  if (customer.email !== undefined) data.email = customer.email
  if (customer.phoneCell !== undefined) data.phone = customer.phoneCell
  else if (customer.phone !== undefined) data.phone = customer.phone
  if (customer.document !== undefined) data.document_id = customer.document
  if (customer.address !== undefined) data.address = customer.address
  return data
}

export const customerService = {
  async checkDocumentExists(document: string, excludeId?: string) {
    const client = ensureClient()
    const cleanDoc = document.replace(/\D/g, '')
    if (!cleanDoc) return false

    try {
      const records = await client.collection('customers').getFullList()
      return records.some(
        (r: any) =>
          r.id !== excludeId && r.document_id && r.document_id.replace(/\D/g, '') === cleanDoc,
      )
    } catch {
      return false
    }
  },

  async getCustomers(): Promise<Customer[]> {
    const client = ensureClient()
    const records = await client.collection('customers').getFullList({ sort: '-created' })
    return records.map(mapFromPb)
  },

  async createCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const client = ensureClient()
    const record = await client.collection('customers').create(mapToPb(customer))
    return mapFromPb(record)
  },

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    const client = ensureClient()
    const record = await client.collection('customers').update(id, mapToPb(customer))
    return mapFromPb(record)
  },

  async deleteCustomer(id: string): Promise<void> {
    const client = ensureClient()
    await client.collection('customers').delete(id)
  },

  async getNextMatricula(): Promise<string> {
    const client = ensureClient()
    try {
      const records = await client.collection('customers').getList(1, 1, { sort: '-created' })
      if (records.items.length > 0) {
        return String((parseInt(records.items[0].id, 36) % 10000) + 1).padStart(4, '0')
      }
    } catch {
      // fall through
    }
    return '0001'
  },

  async uploadDocument(
    _customerId: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<CustomerDocument> {
    if (onProgress) onProgress(100)
    return {
      name: file.name,
      url: URL.createObjectURL(file),
      date: new Date().toISOString(),
      path: file.name,
    }
  },

  async deleteDocument(_path: string): Promise<void> {},
}
