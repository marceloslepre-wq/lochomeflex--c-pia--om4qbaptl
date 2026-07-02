import { useState, useEffect } from 'react'
import useMainStore from '@/stores/main'
import { customerService, Customer } from '@/services/customers'
import { pbCustomerService } from '@/services/pb-customers'
import { useRealtime } from '@/hooks/use-realtime'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { Search, User, Trash2, Download } from 'lucide-react'
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog'
import { ShareCustomerLinkDialog } from '@/components/customers/ShareCustomerLinkDialog'
import { Button } from '@/components/ui/button'
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
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'

export default function Customers() {
  const { globalSearch } = useMainStore()
  const { can } = usePermissions()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [useSkipCloud, setUseSkipCloud] = useState(true)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = useSkipCloud
        ? await pbCustomerService.getCustomers()
        : await customerService.getCustomers()
      setCustomers(data as Customer[])
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os clientes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [useSkipCloud])

  useRealtime(
    'customers',
    () => {
      fetchCustomers()
    },
    useSkipCloud,
  )

  const term = search || globalSearch
  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(term.toLowerCase()) || c.document.includes(term),
  )

  const handleDelete = async (id: string) => {
    try {
      if (useSkipCloud) {
        await pbCustomerService.deleteCustomer(id)
      } else {
        await customerService.deleteCustomer(id)
      }
      setCustomers(customers.filter((c) => c.id !== id))
      toast({ title: 'Cliente Excluído', description: 'O registro foi removido.' })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o cliente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie a base de clientes e empresas.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30">
            <Label
              htmlFor="ds-toggle"
              className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            >
              {useSkipCloud ? 'Skip Cloud' : 'Supabase'}
            </Label>
            <Switch id="ds-toggle" checked={useSkipCloud} onCheckedChange={setUseSkipCloud} />
          </div>
          <ShareCustomerLinkDialog />
          {can('customers:write') && <CustomerFormDialog onSuccess={fetchCustomers} />}
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF/CNPJ..."
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
                <TableHead>Matrícula</TableHead>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Carregando clientes...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((customer) => (
                  <TableRow key={customer.id} className="group">
                    <TableCell className="font-mono text-muted-foreground">
                      {customer.matricula || '-'}
                    </TableCell>
                    <TableCell className="font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User className="w-4 h-4" />
                      </div>
                      {customer.name}
                    </TableCell>
                    <TableCell>{customer.document}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                    <TableCell>
                      {customer.documento_url && customer.documento_url.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {customer.documento_url.map((doc: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span
                                className="truncate max-w-[100px] sm:max-w-[150px]"
                                title={doc.name}
                              >
                                {doc.name}
                              </span>
                              <span className="text-muted-foreground text-[10px] hidden sm:inline-block">
                                {new Date(doc.date).toLocaleDateString()}
                              </span>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                download={doc.name}
                                className="text-primary hover:underline font-medium ml-auto flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                <span className="hidden sm:inline-block">Baixar</span>
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nenhum</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {can('customers:write') && (
                          <CustomerFormDialog
                            customer={customer as any}
                            onSuccess={fetchCustomers}
                          />
                        )}
                        {can('customers:delete') && (
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
                                  Tem certeza que deseja excluir este registro? Esta ação não pode
                                  ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(customer.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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
