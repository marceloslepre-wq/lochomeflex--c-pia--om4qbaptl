import useMainStore from '@/stores/main'
import pb from '@/lib/pocketbase/client'

export type PermissionKey =
  | 'items:write'
  | 'items:delete'
  | 'customers:write'
  | 'customers:delete'
  | 'rentals:manage'
  | 'users:manage'
  | 'reports:view'
  | 'editar_contratos'

export function usePermissions() {
  const { currentUser: storeUser } = useMainStore()

  const currentUser = pb.authStore.record || storeUser

  const can = (perm: PermissionKey) => {
    if (!currentUser) return false
    if (currentUser.role === 'Administrador') return true
    return currentUser.permissions?.includes(perm) ?? false
  }

  return { can, currentUser }
}
