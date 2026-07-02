import pb from '@/lib/pocketbase/client'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export function getContractFileUrl(record: any): string | null {
  if (!record.contract_file) return null
  return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${record.contract_file}`
}

export const pbContractService = {
  async getAll() {
    return await pb.collection('contracts').getFullList({
      sort: '-created',
      expand: 'rental.customer',
    })
  },

  async create(data: { rental: string; signed_at?: string }, file?: File) {
    const formData = new FormData()
    formData.append('rental', data.rental)
    if (data.signed_at) formData.append('signed_at', data.signed_at)
    if (file) formData.append('contract_file', file)
    return await pb.collection('contracts').create(formData)
  },

  async update(id: string, data: Record<string, any>) {
    return await pb.collection('contracts').update(id, data)
  },

  async delete(id: string) {
    await pb.collection('contracts').delete(id)
  },
}
