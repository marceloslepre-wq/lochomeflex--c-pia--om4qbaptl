import pb from '@/lib/pocketbase/client'

export interface LocationRecord {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  active: boolean
  created: string
  updated: string
}

const mapFromPb = (record: any): LocationRecord => ({
  id: record.id,
  name: record.name || '',
  address: record.address || '',
  city: record.city || '',
  state: record.state || '',
  zip_code: record.zip_code || '',
  active: record.active ?? true,
  created: record.created || '',
  updated: record.updated || '',
})

export const pbLocationService = {
  async getLocations(): Promise<LocationRecord[]> {
    const records = await pb.collection('locations').getFullList({ sort: 'name' })
    return records.map(mapFromPb)
  },

  async createLocation(data: Partial<LocationRecord>): Promise<LocationRecord> {
    const record = await pb.collection('locations').create({
      name: data.name || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip_code: data.zip_code || '',
      active: data.active ?? true,
    })
    return mapFromPb(record)
  },

  async updateLocation(id: string, data: Partial<LocationRecord>): Promise<LocationRecord> {
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zip_code !== undefined) updateData.zip_code = data.zip_code
    if (data.active !== undefined) updateData.active = data.active
    const record = await pb.collection('locations').update(id, updateData)
    return mapFromPb(record)
  },

  async deleteLocation(id: string): Promise<void> {
    await pb.collection('locations').delete(id)
  },
}
