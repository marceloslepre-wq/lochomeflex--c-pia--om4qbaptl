import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Edit, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { pbCustomerService } from '@/services/pb-customers'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import type { Customer } from '@/services/customers'

export function PbCustomerFormDialog({
  customer,
  onSuccess,
}: {
  customer?: Customer
  onSuccess?: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phoneCell || customer?.phone || '',
    document_id: customer?.document || '',
    address: typeof customer?.address === 'string' ? customer.address : '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setFieldErrors({ name: 'Nome é obrigatório' })
      return
    }
    setLoading(true)
    setFieldErrors({})
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        document_id: form.document_id.trim(),
        address: form.address.trim(),
      }
      if (customer) {
        await pbCustomerService.updateCustomer(customer.id, payload)
        toast({ title: 'Cliente atualizado', description: 'Dados salvos com sucesso.' })
      } else {
        await pbCustomerService.createCustomer(payload)
        toast({ title: 'Cliente cadastrado', description: `${form.name} adicionado.` })
      }
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro', description: 'Falha ao salvar cliente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {customer ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Edit className="w-4 h-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Novo Cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar Cliente' : 'Cadastrar Cliente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldErrors.name ? 'border-destructive' : ''}
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={fieldErrors.email ? 'border-destructive' : ''}
            />
            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>CPF/CNPJ</Label>
              <Input
                value={form.document_id}
                onChange={(e) => setForm((f) => ({ ...f, document_id: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Endereço</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
