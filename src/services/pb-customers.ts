import pb from '@/lib/pocketbase/client'
import type { Customer } from '@/services/customers'

const mapFromPb = (record: any): Customer => ({
  id: record.id,
  matricula: record.id.slice(-6),
  name: record.name || '',
  document: record.document_id || '',
  phone: record.phone || '',
  phoneCell: record.phone || '',
  email: record.email || '',
  address: record.address as any,
  documento_url: [],
})

export const pbCustomerService = {
  async getCustomers(): Promise<Customer[]> {
    const records = await pb.collection('customers').getFullList({ sort: '-created' })
    return records.map(mapFromPb)
  },

  async deleteCustomer(id: string): Promise<void> {
    await pb.collection('customers').delete(id)
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const record = await pb.collection('customers').create({
      name: data.name || '',
      email: data.email || '',
      phone: data.phoneCell || data.phone || '',
      document_id: data.document || '',
      address: data.address || '',
    })
    return mapFromPb(record)
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.phoneCell !== undefined) updateData.phone = data.phoneCell
    if (data.document !== undefined) updateData.document_id = data.document
    if (data.address !== undefined) updateData.address = data.address
    const record = await pb.collection('customers').update(id, updateData)
    return mapFromPb(record)
  },
}
