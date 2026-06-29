"use client"

import { useState, useTransition } from "react"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateInput } from "@/components/ui/date-input"
import { LoaderButton } from "@/components/ui/loader-button"
import { formatBRL } from "@/lib/utils/sum-parser"
import { formatDateBr } from "@/lib/utils/formatters"
import { prorrogarParcela } from "@/app/(dashboard)/financeiro/actions"

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão crédito",
  cartao_debito: "Cartão débito",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  faturado: "Faturado",
  link_externo: "Link externo",
  outro: "Outro",
}

type Props = {
  parcelaId: string
  clienteNome: string
  descricao: string | null
  numero: number
  totalParcelas: number
  valor: number
  formaPagamento: string | null
  dataVencimento: string
}

function amanha(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function ProrrogarParcelaButton({
  parcelaId,
  clienteNome,
  descricao,
  numero,
  totalParcelas,
  valor,
  formaPagamento,
  dataVencimento,
}: Props) {
  const [open, setOpen] = useState(false)
  const [novaData, setNovaData] = useState(amanha)
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setNovaData(amanha())
    setOpen(true)
  }

  function handleClose() {
    setNovaData(amanha())
    setOpen(false)
  }

  function submit() {
    startTransition(async () => {
      const r = await prorrogarParcela({ parcelaId, novaData })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Vencimento prorrogado com sucesso.")
      handleClose()
    })
  }

  const titulo = descricao ?? `Parcela ${numero}/${totalParcelas}`

  return (
    <>
      <button
        onClick={handleOpen}
        title="Prorrogar vencimento"
        aria-label="Prorrogar vencimento"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/[0.08] text-amber-300 transition-colors hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CalendarClock className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-300" />
              Prorrogar Vencimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Detalhes do pagamento */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/40">
                Detalhes do pagamento
              </p>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-white/70">{clienteNome}</span>
                  <span className="tabular-nums text-sm font-semibold text-white">
                    {formatBRL(valor)}
                  </span>
                </div>
                <p className="text-xs text-white/50">{titulo}</p>
                <div className="flex items-center justify-between gap-2 text-xs text-white/50">
                  <span>
                    {formaPagamento ? (FORMA_LABEL[formaPagamento] ?? formaPagamento) : "—"}
                  </span>
                  <span className="font-medium text-rose-300/80">
                    Vence em {formatDateBr(dataVencimento)}
                  </span>
                </div>
              </div>
            </div>

            {/* Nova data */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-white/55">
                Novo vencimento
              </Label>
              <DateInput
                value={novaData}
                onChange={setNovaData}
                min={amanha()}
                disabled={isPending}
                openOnFocus={false}
              />
              <p className="text-[11px] text-white/35">
                Deve ser uma data posterior a hoje.
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <LoaderButton
              loading={isPending}
              onClick={submit}
              className="bg-amber-600 text-white hover:bg-amber-500"
            >
              Confirmar prorrogação
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
