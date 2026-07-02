import pb from '@/lib/pocketbase/client'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export function getInventoryImageUrl(record: any): string | null {
  if (!record.image) return null
  return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${record.image}`
}

export const pbInventoryService = {
  async getItems() {
    return await pb.collection('inventory').getFullList({ sort: '-created' })
  },

  async createItem(data: Record<string, any>, imageFile?: File) {
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v))
    })
    if (imageFile) formData.append('image', imageFile)
    return await pb.collection('inventory').create(formData)
  },

  async updateItem(id: string, data: Record<string, any>, imageFile?: File) {
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v))
    })
    if (imageFile) formData.append('image', imageFile)
    return await pb.collection('inventory').update(id, formData)
  },

  async deleteItem(id: string) {
    await pb.collection('inventory').delete(id)
  },
}
