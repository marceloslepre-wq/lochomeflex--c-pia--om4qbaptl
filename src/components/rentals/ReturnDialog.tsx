import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import useMainStore, { Rental } from '@/stores/main'
import { useToast } from '@/hooks/use-toast'
import { differenceInDays } from 'date-fns'

export function ReturnDialog({
  rental,
  open,
  onOpenChange,
  onReturned,
}: {
  rental: Rental | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onReturned?: (rental: Rental) => void
}) {
  const { returnRental } = useMainStore()
  const { toast } = useToast()
  const today = new Date().toISOString().split('T')[0]
  const [returnDate, setReturnDate] = useState(today)

  if (!rental) return null

  const handleReturn = async () => {
    await returnRental(rental.id, returnDate)
    toast({
      title: 'Devolução Registrada',
      description: `Estoque atualizado e locação finalizada.`,
    })
    onOpenChange(false)
    if (onReturned) {
      onReturned({ ...rental, status: 'Devolvido', actualReturnDate: returnDate })
    }
  }

  const expected = new Date(rental.expectedReturnDate)
  const actual = new Date(returnDate)
  const delay = differenceInDays(actual, expected)
  const isLate = delay > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Devolução: {rental.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="grid gap-2">
            <Label>Data Efetiva de Devolução</Label>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>

          {isLate && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
              <p className="font-semibold text-sm">Atenção: Devolução em Atraso</p>
              <p className="text-xs mt-1">
                Atraso de {delay} dia(s). Multa sugerida baseada na política do sistema.
              </p>
            </div>
          )}

          <div className="text-sm text-muted-foreground border-t pt-4">
            Ao confirmar, os itens serão reintegrados ao estoque disponível.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleReturn} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
