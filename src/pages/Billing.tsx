import { useState, useEffect } from 'react'
import { PbAuthGate } from '@/components/PbAuthGate'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { pbBillingService } from '@/services/pb-billing'
import { pbRentalService } from '@/services/pb-rentals'
import { pbContractService, getContractFileUrl } from '@/services/pb-contracts'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, FileText, Download } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  unpaid: { label: 'Não Pago', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  overdue: { label: 'Vencido', variant: 'destructive' },
}

export default function Billing() {
  return (
    <PbAuthGate>
      <BillingContent />
    </PbAuthGate>
  )
}

function BillingContent() {
  const { toast } = useToast()
  const [billings, setBillings] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [rentals, setRentals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    rental: '',
    amount: '',
    due_date: '',
    status: 'unpaid',
    payment_method: '',
  })
  const [contractForm, setContractForm] = useState({ rental: '', signed_at: '' })
  const [contractFile, setContractFile] = useState<File | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [billingData, contractData, rentalData] = await Promise.all([
        pbBillingService.getAll(),
        pbContractService.getAll(),
        pbRentalService.getAll(),
      ])
      setBillings(billingData)
      setContracts(contractData)
      setRentals(rentalData)
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar dados.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('billing', () => loadData())
  useRealtime('contracts', () => loadData())

  const handleCreateBilling = async () => {
    setFieldErrors({})
    try {
      await pbBillingService.create({
        rental: form.rental,
        amount: parseFloat(form.amount),
        due_date: form.due_date,
        status: form.status,
        payment_method: form.payment_method,
      })
      toast({ title: 'Cobrança criada' })
      setDialogOpen(false)
      setForm({ rental: '', amount: '', due_date: '', status: 'unpaid', payment_method: '' })
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await pbBillingService.update(id, { status })
      loadData()
    } catch {
      toast({ title: 'Erro', description: 'Falha ao atualizar status.', variant: 'destructive' })
    }
  }

  const handleDeleteBilling = async (id: string) => {
    await pbBillingService.delete(id)
    toast({ title: 'Cobrança removida' })
    loadData()
  }

  const handleCreateContract = async () => {
    setFieldErrors({})
    try {
      if (!contractForm.rental) {
        setFieldErrors({ rental: 'Selecione uma locação' })
        return
      }
      await pbContractService.create(
        { rental: contractForm.rental, signed_at: contractForm.signed_at || undefined },
        contractFile || undefined,
      )
      toast({ title: 'Contrato cadastrado' })
      setContractDialogOpen(false)
      setContractForm({ rental: '', signed_at: '' })
      setContractFile(null)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
    }
  }

  const handleDeleteContract = async (id: string) => {
    await pbContractService.delete(id)
    toast({ title: 'Contrato removido' })
    loadData()
  }

  const getRentalLabel = (rentalId: string) => {
    const r = rentals.find((x) => x.id === rentalId)
    const customerName = r?.expand?.customer?.name || r?.expand?.customer?.name
    return customerName ? `${customerName}` : rentalId.slice(0, 8)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cobranças e Contratos</h1>
        <p className="text-muted-foreground mt-1">Gestão financeira no Skip Cloud.</p>
      </div>

      <Tabs defaultValue="billing">
        <TabsList>
          <TabsTrigger value="billing">Cobranças</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Nova Cobrança
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle>Nova Cobrança</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid gap-2">
                    <Label>Locação *</Label>
                    <Select
                      value={form.rental}
                      onValueChange={(v) => setForm((f) => ({ ...f, rental: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rentals.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.expand?.customer?.name || r.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.rental && (
                      <p className="text-xs text-destructive">{fieldErrors.rental}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                      {fieldErrors.amount && (
                        <p className="text-xs text-destructive">{fieldErrors.amount}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Vencimento *</Label>
                      <Input
                        type="date"
                        value={form.due_date}
                        onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                      />
                      {fieldErrors.due_date && (
                        <p className="text-xs text-destructive">{fieldErrors.due_date}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                          <SelectItem value="unpaid">Não Pago</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="overdue">Vencido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Forma de Pagamento</Label>
                      <Input
                        value={form.payment_method}
                        onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateBilling}>Salvar</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Locação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhuma cobrança encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    billings.map((b) => {
                      const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.unpaid
                      return (
                        <TableRow key={b.id} className="group">
                          <TableCell>{getRentalLabel(b.rental)}</TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {(b.amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {b.due_date ? new Date(b.due_date).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={b.status}
                              onValueChange={(v) => handleStatusChange(b.id, v)}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unpaid">Não Pago</SelectItem>
                                <SelectItem value="paid">Pago</SelectItem>
                                <SelectItem value="overdue">Vencido</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{b.payment_method || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100"
                              onClick={() => handleDeleteBilling(b.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Novo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle>Registrar Contrato</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid gap-2">
                    <Label>Locação *</Label>
                    <Select
                      value={contractForm.rental}
                      onValueChange={(v) => setContractForm((f) => ({ ...f, rental: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rentals.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.expand?.customer?.name || r.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.rental && (
                      <p className="text-xs text-destructive">{fieldErrors.rental}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Data de Assinatura</Label>
                    <Input
                      type="date"
                      value={contractForm.signed_at}
                      onChange={(e) =>
                        setContractForm((f) => ({ ...f, signed_at: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Arquivo do Contrato (PDF/Imagem)</Label>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setContractDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateContract}>Salvar</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Locação</TableHead>
                    <TableHead>Assinado em</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhum contrato encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    contracts.map((c) => (
                      <TableRow key={c.id} className="group">
                        <TableCell>{getRentalLabel(c.rental)}</TableCell>
                        <TableCell>
                          {c.signed_at ? new Date(c.signed_at).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                          {c.contract_file ? (
                            <a
                              href={getContractFileUrl(c) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                            >
                              <Download className="w-3 h-3" /> Baixar
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem arquivo</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteContract(c.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
