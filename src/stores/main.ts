import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import type { Customer } from '@/services/customers'
import { PermissionKey } from '@/hooks/use-permissions'

export type Asset = {
  id: string
  assetNumber: string
  conditionStatus: 'Disponível' | 'Manutenção' | 'Indisponível' | 'Esgotado'
  image?: string
}

export type InventoryItem = {
  id: string
  code: string
  name: string
  category: string
  description?: string
  totalQty: number
  availableQty: number
  rentedQty: number
  conditionStatus: 'Disponível' | 'Manutenção' | 'Indisponível' | 'Esgotado'
  image?: string
  assets?: Asset[]
  monthlyPrice?: number
  dailyPrice?: number
  salePrice?: number
}

export type Address = {
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

export type RentalItem = {
  id?: string
  itemId: string
  qty: number
  startDate?: string
  endDate?: string
  dailyPrice?: number
  totalPrice?: number
}

export type Rental = {
  id: string
  customerId: string
  items: RentalItem[]
  startDate: string
  expectedReturnDate: string
  actualReturnDate?: string
  status: 'Ativo' | 'Atrasado' | 'Devolvido' | 'Cancelado'
  total: number
  customContractText?: string
  customContractHtml?: string
  userId?: string
  pickupLocationId?: string
  contractNumber?: string
}

export type User = {
  id: string
  auth_user_id?: string
  name: string
  email: string
  role: string
  active: boolean
  permissions: PermissionKey[]
}

export type Location = {
  id: string
  name: string
  address: string
}

export type Settings = {
  primaryColor: string
  logoUrl: string | null
  contractFileName: string | null
  contractTemplateHtml: string | null
  lateFeeType: 'daily' | 'fixed'
  lateFeeValue: number
  companyName: string
  companyDocument: string
  companyAddress: string
  locations?: Location[]
  categories?: string[]
}

export type Billing = {
  id: string
  rentalId: string
  amount: number
  dueDate: string
  status: 'unpaid' | 'paid' | 'overdue'
  paymentMethod?: string
}

interface MainStore {
  loading: boolean
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  globalSearch: string
  setGlobalSearch: (search: string) => void
  inventory: InventoryItem[]
  customers: Customer[]
  rentals: Rental[]
  billing: Billing[]
  users: User[]
  settings: Settings
  addRental: (rental: Rental) => Promise<Rental | null>
  returnRental: (rentalId: string, actualReturnDate: string) => void
  updateRental: (id: string, data: Partial<Rental>) => void
  addInventoryItem: (item: InventoryItem) => void
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) => void
  deleteInventoryItem: (id: string) => void
  addCustomer: (customer: Customer) => void
  updateCustomer: (id: string, data: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  updateSettings: (data: Partial<Settings>) => void
  addUser: (user: User) => void
  updateUser: (id: string, data: Partial<User>) => void
  deleteUser: (id: string) => void
  refreshCustomers: () => void
  refreshInventory: () => Promise<void>
  refreshRentals: () => Promise<void>
  refreshBilling: () => Promise<void>
  deleteRental: (id: string) => Promise<void>
  loadItemAssets: (id: string) => Promise<Asset[]>
}

const StoreContext = createContext<MainStore | null>(null)

const PB_URL = import.meta.env.VITE_POCKETBASE_URL as string
const pbReady = !!PB_URL && PB_URL.trim() !== '' && !!pb

const getPbFileUrl = (record: any, fieldName: string): string | undefined => {
  if (!record) return undefined
  const filename = record?.[fieldName]
  if (!filename || !record.collectionId) return undefined
  return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${filename}`
}

const mapInventoryStatusFromPb = (status: string): InventoryItem['conditionStatus'] => {
  switch (status) {
    case 'available':
      return 'Disponível'
    case 'rented':
      return 'Esgotado'
    case 'maintenance':
      return 'Manutenção'
    case 'lost':
      return 'Indisponível'
    default:
      return 'Disponível'
  }
}

const mapInventoryStatusToPb = (status: InventoryItem['conditionStatus']): string => {
  switch (status) {
    case 'Disponível':
      return 'available'
    case 'Manutenção':
      return 'maintenance'
    case 'Indisponível':
      return 'lost'
    case 'Esgotado':
      return 'rented'
    default:
      return 'available'
  }
}

const mapRentalStatusFromPb = (status: string): Rental['status'] => {
  switch (status) {
    case 'active':
      return 'Ativo'
    case 'completed':
      return 'Devolvido'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Ativo'
  }
}

const mapRentalStatusToPb = (status: Rental['status']): string => {
  switch (status) {
    case 'Ativo':
      return 'active'
    case 'Atrasado':
      return 'active'
    case 'Devolvido':
      return 'completed'
    case 'Cancelado':
      return 'cancelled'
    default:
      return 'active'
  }
}

const mapInventoryFromPb = (record: any): InventoryItem => ({
  id: record?.id || '',
  code: record?.sku || '',
  name: record?.name || '',
  category: record?.category || '',
  description: record?.description || '',
  totalQty: 1,
  availableQty: record?.status === 'available' ? 1 : 0,
  rentedQty: record?.status === 'rented' ? 1 : 0,
  conditionStatus: mapInventoryStatusFromPb(record?.status || 'available'),
  image: getPbFileUrl(record, 'image'),
  dailyPrice: Number(record?.daily_rate) || 0,
  monthlyPrice: 0,
  salePrice: 0,
})

const mapRentalFromPb = (record: any): Rental => ({
  id: record?.id || '',
  customerId: record?.customer || '',
  items: Array.isArray(record?.items)
    ? record.items.map((id: string) => ({ itemId: id, qty: 1 }))
    : [],
  startDate: record?.start_date || '',
  expectedReturnDate: record?.end_date || '',
  status: mapRentalStatusFromPb(record?.status || 'active'),
  total: Number(record?.total_price) || 0,
})

const mapBillingFromPb = (record: any): Billing => ({
  id: record?.id || '',
  rentalId: record?.rental || '',
  amount: Number(record?.amount) || 0,
  dueDate: record?.due_date || '',
  status: (record?.status as Billing['status']) || 'unpaid',
  paymentMethod: record?.payment_method || '',
})

const mapCustomerFromPb = (record: any): Customer => ({
  id: record?.id || '',
  name: record?.name || '',
  email: record?.email || '',
  phone: record?.phone || '',
  document: record?.document_id || '',
  address: record?.address || '',
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [billing, setBilling] = useState<Billing[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings>({
    primaryColor: '#1e40af',
    logoUrl: null,
    contractFileName: null,
    contractTemplateHtml: null,
    lateFeeType: 'daily',
    lateFeeValue: 2,
    companyName: 'LocaWeb Gestão de Ativos LTDA',
    companyDocument: '00.000.000/0001-00',
    companyAddress: 'Av. Central, 1000 - Centro, São Paulo/SP',
    locations: [],
    categories: ['Ferramentas', 'Equipamentos Pesados', 'Acessórios', 'Geral'],
  })

  const refreshCustomers = useCallback(async () => {
    if (!pbReady) return
    try {
      const records = await pb.collection('customers').getFullList({ sort: '-created' })
      setCustomers((records || []).map(mapCustomerFromPb))
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }
  }, [])

  const refreshInventory = useCallback(async () => {
    if (!pbReady) return
    try {
      const records = await pb.collection('inventory').getFullList({ sort: '-created' })
      setInventory((records || []).map(mapInventoryFromPb))
    } catch (err) {
      console.error('Failed to fetch inventory:', err)
    }
  }, [])

  const refreshRentals = useCallback(async () => {
    if (!pbReady) return
    try {
      const records = await pb.collection('rentals').getFullList({
        sort: '-created',
        expand: 'customer,items',
      })
      setRentals((records || []).map(mapRentalFromPb))
    } catch (err) {
      console.error('Failed to fetch rentals:', err)
    }
  }, [])

  const refreshBilling = useCallback(async () => {
    if (!pbReady) return
    try {
      const records = await pb.collection('billing').getFullList({
        sort: '-created',
        expand: 'rental.customer',
      })
      setBilling((records || []).map(mapBillingFromPb))
    } catch (err) {
      console.error('Failed to fetch billing:', err)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setInventory([])
      setCustomers([])
      setRentals([])
      setBilling([])
      setUsers([])
      setCurrentUser(null)
      setLoading(false)
      return
    }

    if (!pbReady) {
      console.warn('PocketBase URL is not configured — data will not load.')
      setLoading(false)
      return
    }

    if (pb.authStore.isValid && pb.authStore.record) {
      const record = pb.authStore.record as any
      const mappedUser: User = {
        id: record.id,
        name: record.name || record.email || '',
        email: record.email || '',
        role: record.role || 'Usuario',
        active: true,
        permissions: [],
      }
      setCurrentUser(mappedUser)
      setUsers([mappedUser])
    }

    setLoading(true)
    Promise.all([
      refreshCustomers(),
      refreshInventory(),
      refreshRentals(),
      refreshBilling(),
    ]).finally(() => setLoading(false))
  }, [user?.id, refreshCustomers, refreshInventory, refreshRentals, refreshBilling])

  useRealtime(
    'inventory',
    () => {
      refreshInventory()
    },
    !!user && pbReady,
  )
  useRealtime(
    'rentals',
    () => {
      refreshRentals()
    },
    !!user && pbReady,
  )
  useRealtime(
    'customers',
    () => {
      refreshCustomers()
    },
    !!user && pbReady,
  )
  useRealtime(
    'billing',
    () => {
      refreshBilling()
    },
    !!user && pbReady,
  )

  const addRental = async (rental: Rental): Promise<Rental | null> => {
    const tempId = rental.id || Math.random().toString()
    setRentals((prev) => [{ ...rental, id: tempId }, ...prev])
    setInventory((prev) =>
      prev.map((item) => {
        const rented = rental.items.find((ri) => ri.itemId === item.id)
        if (rented) {
          return {
            ...item,
            availableQty: Math.max(0, item.availableQty - rented.qty),
            rentedQty: item.rentedQty + rented.qty,
          }
        }
        return item
      }),
    )
    if (!pbReady) return rental
    try {
      const record = await pb.collection('rentals').create({
        customer: rental.customerId,
        items: rental.items.map((ri) => ri.itemId),
        start_date: rental.startDate,
        end_date: rental.expectedReturnDate,
        total_price: rental.total,
        status: mapRentalStatusToPb(rental.status),
      })
      const newRental = { ...rental, id: record.id }
      setRentals((prev) => prev.map((r) => (r.id === tempId || r.id === rental.id ? newRental : r)))
      for (const rentItem of rental.items) {
        try {
          await pb.collection('inventory').update(rentItem.itemId, { status: 'rented' })
        } catch (err) {
          console.error('Failed to update inventory status:', err)
        }
      }
      return newRental
    } catch (err) {
      console.error('Failed to create rental:', err)
      setRentals((prev) => prev.filter((r) => r.id !== tempId))
      return null
    }
  }

  const returnRental = async (rentalId: string, actualDate: string) => {
    const rental = rentals.find((r) => r.id === rentalId)
    if (!rental) return
    setRentals((prev) =>
      prev.map((r) =>
        r.id === rentalId ? { ...r, status: 'Devolvido', actualReturnDate: actualDate } : r,
      ),
    )
    setInventory((prev) =>
      prev.map((item) => {
        const rented = rental.items.find((ri) => ri.itemId === item.id)
        if (rented) {
          return {
            ...item,
            availableQty: item.availableQty + rented.qty,
            rentedQty: Math.max(0, item.rentedQty - rented.qty),
          }
        }
        return item
      }),
    )
    if (!pbReady) return
    try {
      await pb.collection('rentals').update(rentalId, { status: 'completed' })
      for (const rentItem of rental.items) {
        try {
          await pb.collection('inventory').update(rentItem.itemId, { status: 'available' })
        } catch (err) {
          console.error('Failed to update inventory status:', err)
        }
      }
    } catch (err) {
      console.error('Failed to return rental:', err)
    }
  }

  const deleteRental = async (id: string) => {
    const rental = rentals.find((r) => r.id === id)
    if (!rental) return
    setRentals((prev) => prev.filter((r) => r.id !== id))
    if (rental.status !== 'Devolvido') {
      setInventory((prev) =>
        prev.map((item) => {
          const rented = rental.items.find((ri) => ri.itemId === item.id)
          if (rented) {
            return {
              ...item,
              availableQty: item.availableQty + rented.qty,
              rentedQty: Math.max(0, item.rentedQty - rented.qty),
            }
          }
          return item
        }),
      )
    }
    if (!pbReady) return
    try {
      await pb.collection('rentals').delete(id)
      if (rental.status !== 'Devolvido') {
        for (const rentItem of rental.items) {
          try {
            await pb.collection('inventory').update(rentItem.itemId, { status: 'available' })
          } catch (err) {
            console.error('Failed to update inventory status:', err)
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete rental:', err)
    }
  }

  const updateRental = async (id: string, updateData: Partial<Rental>) => {
    setRentals((prev) => prev.map((r) => (r.id === id ? { ...r, ...updateData } : r)))
    if (!pbReady) return
    const pbData: Record<string, any> = {}
    if (updateData.status) pbData.status = mapRentalStatusToPb(updateData.status)
    if (updateData.expectedReturnDate) pbData.end_date = updateData.expectedReturnDate
    if (updateData.startDate) pbData.start_date = updateData.startDate
    if (updateData.total !== undefined) pbData.total_price = updateData.total
    if (updateData.customerId) pbData.customer = updateData.customerId
    try {
      await pb.collection('rentals').update(id, pbData)
    } catch (err) {
      console.error('Failed to update rental:', err)
    }
  }

  const addInventoryItem = async (item: InventoryItem) => {
    const tempId = item.id || Math.random().toString()
    setInventory((prev) => [{ ...item, id: tempId }, ...prev])
    if (!pbReady) return
    try {
      const record = await pb.collection('inventory').create({
        name: item.name,
        description: item.description || '',
        sku: item.code,
        category: item.category,
        daily_rate: item.dailyPrice || 0,
        status: mapInventoryStatusToPb(item.conditionStatus),
      })
      setInventory((prev) =>
        prev.map((i) => (i.id === tempId || i.id === item.id ? { ...i, id: record.id } : i)),
      )
    } catch (err) {
      console.error('Failed to create inventory item:', err)
      setInventory((prev) => prev.filter((i) => i.id !== tempId))
    }
  }

  const updateInventoryItem = async (id: string, data: Partial<InventoryItem>) => {
    setInventory((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)))
    if (!pbReady) return
    const pbData: Record<string, any> = {}
    if (data.name !== undefined) pbData.name = data.name
    if (data.description !== undefined) pbData.description = data.description
    if (data.code !== undefined) pbData.sku = data.code
    if (data.category !== undefined) pbData.category = data.category
    if (data.dailyPrice !== undefined) pbData.daily_rate = data.dailyPrice
    if (data.conditionStatus !== undefined)
      pbData.status = mapInventoryStatusToPb(data.conditionStatus)
    try {
      await pb.collection('inventory').update(id, pbData)
    } catch (err) {
      console.error('Failed to update inventory item:', err)
    }
  }

  const deleteInventoryItem = async (id: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== id))
    if (!pbReady) return
    try {
      await pb.collection('inventory').delete(id)
    } catch (err) {
      console.error('Failed to delete inventory item:', err)
    }
  }

  const addCustomer = async (c: Customer) => {
    const tempId = c.id || Math.random().toString()
    setCustomers((prev) => [{ ...c, id: tempId }, ...prev])
    if (!pbReady) return
    try {
      const record = await pb.collection('customers').create({
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        document_id: c.document || '',
        address: c.address || '',
      })
      setCustomers((prev) => prev.map((cu) => (cu.id === tempId ? { ...cu, id: record.id } : cu)))
    } catch (err) {
      console.error('Failed to create customer:', err)
      setCustomers((prev) => prev.filter((cu) => cu.id !== tempId))
    }
  }

  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)))
    if (!pbReady) return
    const pbData: Record<string, any> = {}
    if (data.name !== undefined) pbData.name = data.name
    if (data.email !== undefined) pbData.email = data.email
    if (data.phone !== undefined) pbData.phone = data.phone
    if (data.document !== undefined) pbData.document_id = data.document
    if (data.address !== undefined) pbData.address = data.address
    try {
      await pb.collection('customers').update(id, pbData)
    } catch (err) {
      console.error('Failed to update customer:', err)
      refreshCustomers()
    }
  }

  const deleteCustomer = async (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id))
    if (!pbReady) return
    try {
      await pb.collection('customers').delete(id)
    } catch (err) {
      console.error('Failed to delete customer:', err)
      refreshCustomers()
    }
  }

  const updateSettings = async (data: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...data }))
  }

  const addUser = async (newUser: User) => {
    const tempId = newUser.id || Math.random().toString()
    setUsers((prev) => [...prev, { ...newUser, id: tempId }])
    if (!pbReady) return
    try {
      const record = await pb.collection('users').create({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        password: 'Skip@Pass',
        passwordConfirm: 'Skip@Pass',
      })
      setUsers((prev) =>
        prev.map((u) => (u.id === tempId || u.id === newUser.id ? { ...u, id: record.id } : u)),
      )
    } catch (err) {
      console.error('Failed to create user:', err)
      setUsers((prev) => prev.filter((u) => u.id !== tempId))
    }
  }

  const updateUser = async (id: string, data: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)))
    if (!pbReady) return
    try {
      const pbData: Record<string, any> = {}
      if (data.name !== undefined) pbData.name = data.name
      if (data.role !== undefined) pbData.role = data.role
      await pb.collection('users').update(id, pbData)
    } catch (err) {
      console.error('Failed to update user:', err)
    }
  }

  const deleteUser = async (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    if (!pbReady) return
    try {
      await pb.collection('users').delete(id)
    } catch (err) {
      console.error('Failed to delete user:', err)
    }
  }

  const loadItemAssets = async (_id: string): Promise<Asset[]> => {
    return []
  }

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        loading,
        currentUser,
        setCurrentUser,
        globalSearch,
        setGlobalSearch,
        inventory,
        customers,
        rentals,
        billing,
        users,
        settings,
        addRental,
        returnRental,
        updateRental,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        updateSettings,
        addUser,
        updateUser,
        deleteUser,
        refreshCustomers,
        refreshInventory,
        refreshRentals,
        refreshBilling,
        deleteRental,
        loadItemAssets,
      },
    },
    children,
  )
}

export default function useMainStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useMainStore must be used within a StoreProvider')
  return context
}
