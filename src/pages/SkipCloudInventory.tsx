import { useState, useEffect } from 'react'
import { PbAuthGate } from '@/components/PbAuthGate'
import { usePbAuth } from '@/hooks/use-pb-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { pbInventoryService, getInventoryImageUrl } from '@/services/pb-inventory'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Trash2, Package, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PbInventoryFormDialog } from '@/components/pb/PbInventoryFormDialog'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available: { label: 'Disponível', className: 'bg-emerald-500 hover:bg-emerald-600 border-none' },
  rented: { label: 'Locado', className: 'bg-blue-500 hover:bg-blue-600 border-none' },
  maintenance: { label: 'Manutenção', className: 'bg-amber-500 hover:bg-amber-600 border-none' },
  lost: { label: 'Perdido', className: 'bg-red-500 hover:bg-red-600 border-none' },
}

export default function SkipCloudInventory() {
  return (
    <PbAuthGate>
      <SkipCloudInventoryContent />
    </PbAuthGate>
  )
}

function SkipCloudInventoryContent() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await pbInventoryService.getItems()
      setItems(data)
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar inventário.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('inventory', () => loadData())

  const filtered = items.filter((item) => {
    const term = search.toLowerCase()
    const matchesSearch =
      (item.name || '').toLowerCase().includes(term) ||
      (item.sku || '').toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term)
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleDelete = async (id: string) => {
    try {
      await pbInventoryService.deleteItem(id)
      toast({ title: 'Item excluído' })
      loadData()
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventário (Cloud)</h1>
          <p className="text-muted-foreground mt-1">Gestão de itens no Skip Cloud.</p>
        </div>
        <PbInventoryFormDialog onSuccess={loadData} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou categoria..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="available">Disponível</SelectItem>
            <SelectItem value="rented">Locado</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum item encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.available
            const imgUrl = getInventoryImageUrl(item)
            return (
              <Card
                key={item.id}
                className="overflow-hidden group hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  {imgUrl ? (
                    <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground opacity-40" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                    <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>SKU: {item.sku || '-'}</p>
                    <p>Categoria: {item.category || '-'}</p>
                  </div>
                  <p className="text-lg font-bold text-primary">
                    R$ {(item.daily_rate || 0).toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground">/dia</span>
                  </p>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <PbInventoryFormDialog item={item} onSuccess={loadData} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(item.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
