import { useState, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Plus, Edit, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { pbLocationService, type LocationRecord } from '@/services/pb-locations'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  location?: LocationRecord
  onSuccess?: () => void
}

export function LocationFormDialog({ location, onSuccess }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    active: true,
  })

  useEffect(() => {
    if (location) {
      setForm({
        name: location.name || '',
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        zip_code: location.zip_code || '',
        active: location.active ?? true,
      })
    }
  }, [location])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setFieldErrors({})
      if (!location) {
        setForm({ name: '', address: '', city: '', state: '', zip_code: '', active: true })
      }
    }
  }

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
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip_code: form.zip_code.trim(),
        active: form.active,
      }
      if (location) {
        await pbLocationService.updateLocation(location.id, payload)
        toast({ title: 'Local atualizado', description: 'Dados salvos com sucesso.' })
      } else {
        await pbLocationService.createLocation(payload)
        toast({ title: 'Local cadastrado', description: `${form.name} adicionado.` })
      }
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro', description: 'Falha ao salvar local.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {location ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Edit className="w-4 h-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Novo Local
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{location ? 'Editar Local' : 'Cadastrar Local'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Sede Principal"
              className={fieldErrors.name ? 'border-destructive' : ''}
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label>Endereço</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Rua, número, bairro..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Cidade</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                maxLength={2}
                placeholder="ES"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>CEP</Label>
            <Input
              value={form.zip_code}
              onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
              placeholder="00000-000"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="active-toggle"
              checked={form.active}
              onCheckedChange={(c) => setForm((f) => ({ ...f, active: !!c }))}
            />
            <Label htmlFor="active-toggle" className="cursor-pointer">
              Ativo
            </Label>
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
