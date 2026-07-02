import pb from '@/lib/pocketbase/client'

export const pbRentalService = {
  async getAll() {
    return await pb.collection('rentals').getFullList({
      sort: '-created',
      expand: 'customer,items',
    })
  },

  async getById(id: string) {
    return await pb.collection('rentals').getOne(id, { expand: 'customer,items' })
  },

  async create(data: {
    customer: string
    items: string[]
    start_date: string
    end_date?: string
    total_price?: number
    status?: string
  }) {
    return await pb.collection('rentals').create(data)
  },

  async update(id: string, data: Record<string, any>) {
    return await pb.collection('rentals').update(id, data)
  },

  async delete(id: string) {
    await pb.collection('rentals').delete(id)
  },
}
