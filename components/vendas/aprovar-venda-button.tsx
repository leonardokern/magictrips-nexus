"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { aprovarVenda } from "@/app/(dashboard)/vendas/actions"
import { formatBRL } from "@/lib/utils/sum-parser"

type Props = {
  vendaId: string
  clienteNome: string
  totalVenda: string
  /** Dados de desfluxo da venda — quando > 0, exibe toggle pro gerente
   *  desativar antes de aprovar. Calculado no banco (trigger). */
  desfluxoPercentual?: number
  desfluxoMeses?: number
  /** Total bruto de custo (sem desfluxo aplicado), pra preview do efeito. */
  totalCusto?: number
  /** Total bruto de RAV (= soma de rav + extras), pra preview. */
  totalRav?: number
  /** % de comissão do agente, pra preview. */
  comissaoPercentual?: number | null
}

export function AprovarVendaButton({
  vendaId,
  clienteNome,
  totalVenda,
  desfluxoPercentual = 0,
  desfluxoMeses = 0,
  totalCusto = 0,
  totalRav = 0,
  comissaoPercentual = null,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Toggle: por padrão DESFLUXO LIGADO. Se gerente desligar, marca pra
  // chamar aprovar_venda(..., p_ignorar_desfluxo=true).
  const [considerarDesfluxo, setConsiderarDesfluxo] = useState(true)

  const temDesfluxo = desfluxoPercentual > 0
  // Preview: recalcula custo/RAV/comissão em tempo real conforme o toggle.
  const percentualAtivo = temDesfluxo && considerarDesfluxo ? desfluxoPercentual : 0
  const custoExtra = (totalCusto * percentualAtivo) / 100
  const custoEfetivo = totalCusto + custoExtra
  const ravEfetivo = totalRav - custoExtra
  const comissaoEfetiva =
    comissaoPercentual != null ? (ravEfetivo * comissaoPercentual) / 100 : 0

  function handleConfirmar() {
    startTransition(async () => {
      const r = await aprovarVenda(vendaId, {
        ignorarDesfluxo: temDesfluxo && !considerarDesfluxo,
      })
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao aprovar venda.")
      } else {
        toast.success("Venda aprovada com sucesso.")
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 text-white hover:bg-emerald-500"
      >
        <CheckCircle className="mr-2 h-4 w-4" />
        Aprovar venda
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Confirmar aprovação
            </DialogTitle>
            <DialogDescription>
              Você está aprovando a venda de{" "}
              <strong className="text-white">{clienteNome}</strong> no valor de{" "}
              <strong className="text-white">{totalVenda}</strong>. Essa ação
              ficará registrada com seu nome e não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {/* Toggle de desfluxo — só aparece se a venda TEM desfluxo a aplicar */}
          {temDesfluxo && (
            <div className="space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="desfluxo-toggle"
                  className="flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium text-amber-200">
                    Considerar desfluxo de caixa
                  </span>
                  <span className="text-[11px] text-amber-300/70">
                    {desfluxoMeses} {desfluxoMeses === 1 ? "mês" : "meses"} de
                    diferença · +{desfluxoPercentual.toFixed(2).replace(".", ",")}%
                    sobre custo
                  </span>
                </Label>
                <Switch
                  id="desfluxo-toggle"
                  checked={considerarDesfluxo}
                  onCheckedChange={setConsiderarDesfluxo}
                  disabled={isPending}
                />
              </div>
              {/* Preview em tempo real dos valores efetivos */}
              <div className="grid grid-cols-3 gap-2 border-t border-amber-500/15 pt-2 text-[11px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/45">Custo</span>
                  <span className="tabular-nums text-white/85">
                    {formatBRL(custoEfetivo)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/45">RAV</span>
                  <span className="tabular-nums text-white/85">
                    {formatBRL(ravEfetivo)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/45">Comissão</span>
                  <span className="tabular-nums text-amber-300">
                    {formatBRL(comissaoEfetiva)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Aprovando…
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar aprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
