"use client"

import { useState, useTransition } from "react"
import { CheckCircle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateInput } from "@/components/ui/date-input"
import { LoaderButton } from "@/components/ui/loader-button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { marcarFaturaPaga } from "@/app/(dashboard)/faturas/actions"
import type { CaixaItem } from "@/app/(dashboard)/cartoes/actions"

type Props = {
  open: boolean
  onClose: () => void
  faturaId: string
  faturaNumero: string
  valorTotal: number
  caixas: CaixaItem[]
}

export function MarcarFaturaPagaModal({ open, onClose, faturaId, faturaNumero, valorTotal, caixas }: Props) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [caixaId, setCaixaId] = useState("")
  const [dataPagamento, setDataPagamento] = useState(hoje)
  const [valorRecebido, setValorRecebido] = useState(String(valorTotal.toFixed(2)).replace(".", ","))
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setCaixaId("")
    setDataPagamento(hoje)
    setValorRecebido(String(valorTotal.toFixed(2)).replace(".", ","))
    onClose()
  }

  function submit() {
    if (!caixaId) { toast.error("Selecione a caixa de destino."); return }
    const valorNum = parseFloat(valorRecebido.replace(/\./g, "").replace(",", "."))
    if (isNaN(valorNum) || valorNum <= 0) { toast.error("Informe o valor recebido."); return }

    startTransition(async () => {
      const r = await marcarFaturaPaga({
        faturaId,
        caixaId,
        dataPagamento,
        valorRecebido: valorNum,
      })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("Fatura marcada como paga. Parcelas atualizadas.")
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            Registrar Pagamento
          </DialogTitle>
          <p className="text-sm text-white/50">{faturaNumero}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Caixa de destino</Label>
            <Select value={caixaId} onValueChange={setCaixaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar caixa…" />
              </SelectTrigger>
              <SelectContent>
                {caixas.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Data do recebimento</Label>
            <DateInput value={dataPagamento} onChange={setDataPagamento} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-white/55">Valor recebido</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <span className="shrink-0 text-white/40">R$</span>
              <Input
                className="border-0 bg-transparent p-0 focus-visible:ring-0"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>Cancelar</Button>
          </DialogClose>
          <LoaderButton
            loading={isPending}
            onClick={submit}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            Confirmar recebimento
          </LoaderButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
