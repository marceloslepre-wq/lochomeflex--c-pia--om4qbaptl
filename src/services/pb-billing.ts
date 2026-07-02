import pb from '@/lib/pocketbase/client'

export const pbBillingService = {
  async getAll() {
    return await pb.collection('billing').getFullList({
      sort: '-created',
      expand: 'rental.customer',
    })
  },

  async create(data: {
    rental: string
    amount: number
    due_date: string
    status?: string
    payment_method?: string
  }) {
    return await pb.collection('billing').create(data)
  },

  async update(id: string, data: Record<string, any>) {
    return await pb.collection('billing').update(id, data)
  },

  async delete(id: string) {
    await pb.collection('billing').delete(id)
  },
}
