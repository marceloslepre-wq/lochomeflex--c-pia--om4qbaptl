import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, MapPin, Trash2 } from 'lucide-react'
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
import { LocationFormDialog } from '@/components/locations/LocationFormDialog'
import { pbLocationService, type LocationRecord } from '@/services/pb-locations'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function Locations() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [locations, setLocations] = useState<LocationRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await pbLocationService.getLocations()
      setLocations(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os locais.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  useRealtime('locations', () => {
    fetchLocations()
  })

  const handleDelete = async (id: string) => {
    try {
      await pbLocationService.deleteLocation(id)
      setLocations(locations.filter((l) => l.id !== id))
      toast({ title: 'Local Excluído', description: 'O registro foi removido.' })
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o local.',
        variant: 'destructive',
      })
    }
  }

  const filtered = locations.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.address.toLowerCase().includes(search.toLowerCase()) ||
      l.city.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locais de Retirada e Devolução</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os pontos de retirada e devolução de equipamentos.
          </p>
        </div>
        <LocationFormDialog onSuccess={fetchLocations} />
      </div>

      <Card>
        <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, endereço ou cidade..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>CEP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Carregando locais...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhum local encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((location) => (
                  <TableRow key={location.id} className="group">
                    <TableCell className="font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <MapPin className="w-4 h-4" />
                      </div>
                      {location.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.address || '-'}
                    </TableCell>
                    <TableCell>{location.city || '-'}</TableCell>
                    <TableCell>{location.state || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.zip_code || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.active ? 'default' : 'secondary'}>
                        {location.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <LocationFormDialog location={location} onSuccess={fetchLocations} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir "{location.name}"? Esta ação não pode
                                ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(location.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
