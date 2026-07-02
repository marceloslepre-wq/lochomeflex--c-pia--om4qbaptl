import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

interface PbAuthContextType {
  pbUser: any
  isPbAuthenticated: boolean
  pbSignIn: (email: string, password: string) => Promise<{ error: any }>
  pbSignUp: (email: string, password: string, name?: string) => Promise<{ error: any }>
  pbSignOut: () => void
  pbLoading: boolean
}

const PbAuthContext = createContext<PbAuthContextType | undefined>(undefined)

export const usePbAuth = () => {
  const ctx = useContext(PbAuthContext)
  if (!ctx) throw new Error('usePbAuth must be used within PbAuthProvider')
  return ctx
}

export const PbAuthProvider = ({ children }: { children: ReactNode }) => {
  const [pbUser, setPbUser] = useState<any>(pb.authStore.isValid ? pb.authStore.record : null)
  const [isPbAuthenticated, setIsPbAuthenticated] = useState(pb.authStore.isValid)
  const [pbLoading, setPbLoading] = useState(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => {
      setPbUser(pb.authStore.isValid ? record : null)
      setIsPbAuthenticated(pb.authStore.isValid)
    })
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setPbLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setPbLoading(false)
    }
    return () => {
      unsub()
    }
  }, [])

  const pbSignIn = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const pbSignUp = async (email: string, password: string, name?: string) => {
    try {
      await pb.collection('users').create({ email, password, passwordConfirm: password, name })
      await pb.collection('users').authWithPassword(email, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const pbSignOut = () => {
    pb.authStore.clear()
  }

  return (
    <PbAuthContext.Provider
      value={{ pbUser, isPbAuthenticated, pbSignIn, pbSignUp, pbSignOut, pbLoading }}
    >
      {children}
    </PbAuthContext.Provider>
  )
}
