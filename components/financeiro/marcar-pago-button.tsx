"use client"

import { useState, useTransition } from "react"
import { Check, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateInput } from "@/components/ui/date-input"
import { LoaderButton } from "@/components/ui/loader-button"
import { marcarParcelaPaga } from "@/app/(dashboard)/financeiro/actions"
import { cn } from "@/lib/utils"

type Props = {
  tipo: "receber" | "pagar"
  parcelaId: string
  /** "pago" → abre modal pedindo data e marca como pago.
   *  "pendente" → desfaz pagamento (volta pra pendente). */
  acao: "pago" | "pendente"
  /** Resumo curto mostrado no modal — ex: "Parcela 2/3 · R$ 350,00". */
  resumo: string
  /** Data sugerida no input (usa hoje se omitido). */
  dataSugerida?: string
}

/**
 * Botão único que abre modal de confirmação. Marca a parcela como paga
 * (com data) ou desfaz o pagamento. Após sucesso, recarrega via
 * router.refresh — não precisa do caller.
 */
export function MarcarPagoButton({
  tipo,
  parcelaId,
  acao,
  resumo,
  dataSugerida,
}: Props) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(dataSugerida ?? hoje)
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const r = await marcarParcelaPaga({
        tipo,
        parcelaId,
        status: acao,
        dataPagamento: acao === "pago" ? data : null,
      })
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao atualizar parcela.")
        return
      }
      toast.success(
        acao === "pago"
          ? tipo === "receber"
            ? "Pagamento recebido registrado."
            : "Pagamento realizado registrado."
          : "Pagamento desfeito.",
      )
      setOpen(false)
    })
  }

  const isPago = acao === "pago"
  const tom = isPago ? "emerald" : "amber"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          isPago
            ? tipo === "receber"
              ? "Marcar como recebido"
              : "Marcar como pago"
            : "Desfazer pagamento"
        }
        aria-label={isPago ? "Marcar como pago" : "Desfazer pagamento"}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          tom === "emerald"
            ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/15"
            : "border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15",
        )}
      >
        {isPago ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isPago
                ? tipo === "receber"
                  ? "Confirmar recebimento"
                  : "Confirmar pagamento"
                : "Desfazer pagamento"}
            </DialogTitle>
            <DialogDescription>{resumo}</DialogDescription>
          </DialogHeader>

          {isPago && (
            <div className="space-y-2 py-2">
              <Label htmlFor="data-pag" className="text-xs uppercase tracking-wider text-white/55">
                Data do {tipo === "receber" ? "recebimento" : "pagamento"}
              </Label>
              <DateInput value={data} onChange={setData} />
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <LoaderButton
              loading={isPending}
              onClick={submit}
              className={
                isPago
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              }
            >
              {isPago
                ? tipo === "receber"
                  ? "Confirmar recebimento"
                  : "Confirmar pagamento"
                : "Desfazer pagamento"}
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
