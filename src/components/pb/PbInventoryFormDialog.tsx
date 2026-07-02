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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { pbInventoryService, getInventoryImageUrl } from '@/services/pb-inventory'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponível' },
  { value: 'rented', label: 'Locado' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'lost', label: 'Perdido' },
]

export function PbInventoryFormDialog({ item, onSuccess }: { item?: any; onSuccess?: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    daily_rate: '',
    status: 'available',
  })

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || '',
        sku: item.sku || '',
        description: item.description || '',
        category: item.category || '',
        daily_rate: item.daily_rate ? String(item.daily_rate) : '',
        status: item.status || 'available',
      })
      setImagePreview(getInventoryImageUrl(item))
    } else {
      setForm({
        name: '',
        sku: '',
        description: '',
        category: '',
        daily_rate: '',
        status: 'available',
      })
      setImagePreview(null)
    }
    setImageFile(null)
    setFieldErrors({})
  }, [item, open])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.daily_rate) {
      setFieldErrors({
        ...(!form.name.trim() && { name: 'Nome é obrigatório' }),
        ...(!form.daily_rate && { daily_rate: 'Valor diário é obrigatório' }),
      })
      return
    }
    setLoading(true)
    setFieldErrors({})
    try {
      const data = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        daily_rate: parseFloat(form.daily_rate),
        status: form.status,
      }
      if (item) {
        await pbInventoryService.updateItem(item.id, data, imageFile || undefined)
        toast({ title: 'Item atualizado' })
      } else {
        await pbInventoryService.createItem(data, imageFile || undefined)
        toast({ title: 'Item cadastrado' })
      }
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro', description: 'Falha ao salvar item.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Edit className="w-4 h-4 text-primary" />
          </Button>
        ) : (
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Novo Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item' : 'Cadastrar Item'}</DialogTitle>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>SKU</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className={fieldErrors.sku ? 'border-destructive' : ''}
              />
              {fieldErrors.sku && <p className="text-xs text-destructive">{fieldErrors.sku}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor Diário (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.daily_rate}
                onChange={(e) => setForm((f) => ({ ...f, daily_rate: e.target.value }))}
                className={fieldErrors.daily_rate ? 'border-destructive' : ''}
              />
              {fieldErrors.daily_rate && (
                <p className="text-xs text-destructive">{fieldErrors.daily_rate}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="resize-none h-20"
            />
          </div>
          <div className="grid gap-2">
            <Label>Imagem</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="h-24 w-24 object-cover rounded border"
              />
            )}
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
