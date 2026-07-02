import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import Index from './pages/Index'
import { AuthProvider } from './hooks/use-auth'
import { StoreProvider } from './stores/main'
import { ProtectedRoute } from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import ItemDetail from './pages/ItemDetail'
import Customers from './pages/Customers'
import Assets from './pages/Assets'
import Rentals from './pages/Rentals'
import RentalDetail from './pages/RentalDetail'
import Settings from './pages/Settings'
import Guide from './pages/Guide'
import NotFound from './pages/NotFound'
import PublicCustomerForm from './pages/PublicCustomerForm'
import PublicAssetForm from './pages/PublicAssetForm'
import PublicTransfer from './pages/PublicTransfer'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Migration from './pages/Migration'
import { PbAuthProvider } from '@/hooks/use-pb-auth'
import SkipCloudInventory from './pages/SkipCloudInventory'
import Billing from './pages/Billing'
import Chat from './pages/Chat'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

const OverdueChecker = () => {
  useEffect(() => {
    const checkOverdue = async () => {
      if (!supabase) return
      try {
        await supabase.rpc('update_overdue_rentals')
      } catch (error) {
        console.error('Erro ao atualizar locações atrasadas:', error)
      }
    }

    // Run once on app initialization
    checkOverdue()
  }, [])
  return null
}

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AuthProvider>
      <PbAuthProvider>
        <StoreProvider>
          <TooltipProvider>
            <OverdueChecker />
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/public/customer/new" element={<PublicCustomerForm />} />
              <Route path="/public/asset/new" element={<PublicAssetForm />} />
              <Route path="/public/transfer" element={<PublicTransfer />} />
              <Route path="/public/forgot-password" element={<ForgotPassword />} />
              <Route path="/public/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/inventory/:id" element={<ItemDetail />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/rentals" element={<Rentals />} />
                  <Route path="/rentals/:id" element={<RentalDetail />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/guide" element={<Guide />} />
                  <Route path="/sc-inventory" element={<SkipCloudInventory />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/migration" element={<Migration />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </StoreProvider>
      </PbAuthProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
