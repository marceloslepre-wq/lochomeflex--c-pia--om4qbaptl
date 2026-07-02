import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
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
import { Edit, Trash2 } from 'lucide-react'
import useMainStore, { InventoryItem } from '@/stores/main'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { ScrollArea } from '@/components/ui/scroll-area'

const LOCATIONS = [
  'Galpão',
  'Loja Vitória',
  'Loja Cariacica',
  'Loja Vila Velha',
  'Loja Serra',
  'Matriz',
]

export function EditItemDialog({ item }: { item: InventoryItem }) {
  const { updateInventoryItem, settings } = useMainStore()
  const { toast } = useToast()
  const { can } = usePermissions()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: item.name,
    code: item.code,
    category: item.category,
    qty: item.totalQty.toString(),
    description: item.description || '',
    image: item.image,
    conditionStatus: item.conditionStatus,
    monthlyPrice: item.monthlyPrice?.toString() || '',
    dailyPrice: item.dailyPrice?.toString() || '',
    salePrice: item.salePrice?.toString() || '',
  })

  const [locs, setLocs] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      supabase
        .from('inventory_locations')
        .select('*')
        .eq('inventory_id', item.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setLocs(data)
          } else {
            setLocs([
              {
                location_id: 'Galpão',
                quantity: item.totalQty,
                rented_qty: item.rentedQty,
                available_qty: item.availableQty,
              },
            ])
          }
        })
    }
  }, [open, item.id, item.totalQty, item.rentedQty, item.availableQty])

  if (!can('items:write')) return null

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((f) => ({ ...f, image: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const addLoc = () => {
    setLocs([...locs, { location_id: LOCATIONS[0], quantity: 1, rented_qty: 0, available_qty: 1 }])
  }

  const removeLoc = (idx: number) => {
    setLocs(locs.filter((_, i) => i !== idx))
  }

  const updateLoc = (idx: number, field: string, value: any) => {
    const newLocs = [...locs]
    newLocs[idx][field] = value
    if (field === 'quantity') {
      newLocs[idx].available_qty = Math.max(0, value - (newLocs[idx].rented_qty || 0))
    }
    setLocs(newLocs)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const totalSum = locs.reduce((acc, curr) => acc + curr.quantity, 0)
    if (totalSum <= 0) {
      toast({
        title: 'Erro',
        description: 'O total consolidado deve ser maior que 0.',
        variant: 'destructive',
      })
      return
    }

    const locIds = locs.map((l) => l.location_id)
    if (new Set(locIds).size !== locIds.length) {
      toast({
        title: 'Erro',
        description: 'Existem locais duplicados. Agrupe as quantidades no mesmo local.',
        variant: 'destructive',
      })
      return
    }

    const galpaoLoc = locs.find((l) => l.location_id === 'Galpão')
    if (!galpaoLoc || galpaoLoc.quantity <= 0) {
      toast({
        title: 'Erro',
        description:
          'O estoque deve ser primeiramente recebido e mantido no Galpão antes de distribuição.',
        variant: 'destructive',
      })
      return
    }

    const diff = totalSum - item.totalQty
    const newAvailable = Math.max(0, item.availableQty + diff)

    updateInventoryItem(item.id, {
      name: formData.name,
      code: formData.code,
      category: formData.category || 'Geral',
      description: formData.description,
      totalQty: totalSum,
      availableQty: newAvailable,
      image: formData.image || item.image,
      conditionStatus: formData.conditionStatus,
      monthlyPrice: parseFloat(formData.monthlyPrice) || 0,
      dailyPrice: parseFloat(formData.dailyPrice) || 0,
      salePrice: parseFloat(formData.salePrice) || 0,
    })

    await supabase.from('inventory_locations').delete().eq('inventory_id', item.id)
    const toInsert = locs.map((l) => ({
      inventory_id: item.id,
      location_id: l.location_id,
      quantity: l.quantity,
      rented_qty: l.rented_qty || 0,
      available_qty: l.quantity - (l.rented_qty || 0),
    }))

    if (toInsert.length > 0) {
      await supabase.from('inventory_locations').insert(toInsert)
    }

    toast({ title: 'Item Atualizado', description: `${formData.name} modificado com sucesso.` })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar">
          <Edit className="w-4 h-4 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Item: {item.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[450px] mt-4 pr-4">
          <form id="edit-item-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome do Modelo</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Código (SKU)</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.categories?.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.monthlyPrice}
                  onChange={(e) => setFormData((f) => ({ ...f, monthlyPrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor Diário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.dailyPrice}
                  onChange={(e) => setFormData((f) => ({ ...f, dailyPrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                className="resize-none h-20"
              />
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Status Geral</Label>
                <Select
                  value={formData.conditionStatus}
                  onValueChange={(v) => setFormData((f) => ({ ...f, conditionStatus: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Manutenção">Em Manutenção</SelectItem>
                    <SelectItem value="Indisponível">Indisponível</SelectItem>
                    <SelectItem value="Esgotado">Esgotado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 p-3 bg-muted/30 rounded-md border">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Distribuição de Estoque</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLoc}>
                    + Adicionar Local
                  </Button>
                </div>
                {locs.map((l, idx) => (
                  <div key={idx} className="flex items-end gap-2 mt-2">
                    <div className="flex-1">
                      <Label className="text-xs">Local</Label>
                      <Select
                        value={l.location_id}
                        onValueChange={(v) => updateLoc(idx, 'location_id', v)}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCATIONS.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        className="bg-background"
                        value={l.quantity}
                        onChange={(e) => updateLoc(idx, 'quantity', parseInt(e.target.value) || 0)}
                        min={l.rented_qty || 0}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive mb-0.5 hover:bg-destructive/10"
                      onClick={() => removeLoc(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between items-center bg-background p-2 rounded border mt-2">
                  <span className="text-sm font-medium">Total Consolidado</span>
                  <span className="font-bold text-lg">
                    {locs.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Alterar Imagem</Label>
              <Input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleImageUpload}
              />
            </div>
            {formData.image && (
              <div className="flex justify-center mt-2">
                <img
                  src={formData.image}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded shadow-sm border"
                />
              </div>
            )}
          </form>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t mt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-item-form">
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
