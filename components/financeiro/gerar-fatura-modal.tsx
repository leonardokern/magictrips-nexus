"use client"

import { useEffect, useState, useTransition } from "react"
import { FileText, Loader2, Receipt, CheckSquare, Square } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatBRL } from "@/lib/utils/sum-parser"
import { formatDateBr } from "@/lib/utils/formatters"
import {
  getParcelasPendentesDoCliente,
  criarFatura,
  type ClienteComParcelas,
  type ParcelaParaFatura,
} from "@/app/(dashboard)/financeiro/actions"

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
  open: boolean
  onClose: () => void
  clientes: ClienteComParcelas[]
  /** Cliente pré-selecionado ao abrir — usado quando o modal é disparado
   *  a partir de uma conta a receber específica (ex: modal de detalhe da
   *  agenda). Quando definido, carrega as parcelas desse cliente já no
   *  primeiro render. */
  initialClienteId?: string
}

export function GerarFaturaModal({
  open,
  onClose,
  clientes,
  initialClienteId,
}: Props) {
  const [clienteId, setClienteId] = useState("")
  const [parcelas, setParcelas] = useState<ParcelaParaFatura[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [loadingParcelas, setLoadingParcelas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Pré-seleciona quando `initialClienteId` é passado e o modal está aberto.
  // Reaplica também se o id mudar enquanto o modal continua aberto.
  useEffect(() => {
    if (!open) return
    if (!initialClienteId) return
    if (clienteId === initialClienteId) return
    handleClienteChange(initialClienteId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialClienteId])

  function handleClose() {
    setClienteId("")
    setParcelas([])
    setSelecionadas(new Set())
    setError(null)
    onClose()
  }

  async function handleClienteChange(id: string) {
    setClienteId(id)
    setSelecionadas(new Set())
    setError(null)
    if (!id) { setParcelas([]); return }
    setLoadingParcelas(true)
    try {
      const data = await getParcelasPendentesDoCliente(id)
      setParcelas(data)
      // Pré-seleciona todas as parcelas pendentes
      setSelecionadas(new Set(data.map((p) => p.id)))
    } finally {
      setLoadingParcelas(false)
    }
  }

  function toggleParcela(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas() {
    if (parcelas.every((p) => selecionadas.has(p.id))) {
      setSelecionadas(new Set())
    } else {
      setSelecionadas(new Set(parcelas.map((p) => p.id)))
    }
  }

  const totalSelecionado = parcelas
    .filter((p) => selecionadas.has(p.id))
    .reduce((sum, p) => sum + p.valor, 0)

  const todasSelecionadas =
    parcelas.length > 0 && parcelas.every((p) => selecionadas.has(p.id))

  function handleGerar() {
    if (selecionadas.size === 0) {
      setError("Selecione ao menos uma parcela.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await criarFatura({
        clienteId,
        parcelaIds: Array.from(selecionadas),
      })
      if (!result.ok) {
        if (result.fatura_existente_id) {
          // Abre a fatura existente e fecha o modal
          window.open(`/api/faturas/${result.fatura_existente_id}/pdf`, "_blank", "noopener")
          handleClose()
        } else {
          setError(result.error)
        }
        return
      }
      // Sucesso — abre o PDF gerado
      window.open(`/api/faturas/${result.fatura.id}/pdf`, "_blank", "noopener")
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-nexus-bright" />
            Gerar Fatura
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {/* Seletor de cliente */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              Cliente
            </label>
            <Select value={clienteId} onValueChange={handleClienteChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar cliente…" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de parcelas */}
          {clienteId && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-white/60">
                  Parcelas disponíveis
                </label>
                {parcelas.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleTodas}
                    className="flex items-center gap-1.5 text-xs text-nexus-bright hover:text-nexus-bright/80"
                  >
                    {todasSelecionadas ? (
                      <CheckSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    {todasSelecionadas ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                )}
              </div>

              {loadingParcelas ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              ) : parcelas.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-sm text-white/40">
                  Nenhuma parcela pendente para este cliente.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                  {parcelas.map((p, i) => {
                    const checked = selecionadas.has(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleParcela(p.id)}
                        className={[
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                          i > 0 ? "border-t border-white/[0.04]" : "",
                          checked
                            ? "bg-nexus-bright/[0.06] hover:bg-nexus-bright/[0.09]"
                            : "bg-white/[0.02] hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <span className="mt-0.5 shrink-0">
                          {checked ? (
                            <CheckSquare className="h-4 w-4 text-nexus-bright" />
                          ) : (
                            <Square className="h-4 w-4 text-white/30" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-white">
                              {p.venda_identificador
                                ? `${p.venda_identificador} — Parc. ${p.numero}/${p.total_parcelas}`
                                : p.descricao ?? `Parcela ${p.numero}/${p.total_parcelas}`}
                            </span>
                            <span className="shrink-0 tabular-nums text-sm font-semibold text-white">
                              {formatBRL(p.valor)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/45">
                            <div className="flex items-center gap-2">
                              <span>Vence {formatDateBr(p.data_vencimento)}</span>
                              {p.forma_pagamento && (
                                <>
                                  <span>·</span>
                                  <span>{FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</span>
                                </>
                              )}
                            </div>
                            {p.fatura_numeros_display && (
                              <div className="mt-0.5 font-mono text-amber-400/80" title="Já incluída em fatura(s)">
                                {p.fatura_numeros_display}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
        </div>

        {/* Footer sticky */}
        <div className="shrink-0 border-t border-white/[0.06] bg-card/95 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {selecionadas.size > 0 ? (
                <span className="text-white/70">
                  <span className="font-semibold text-white">{selecionadas.size}</span>{" "}
                  {selecionadas.size === 1 ? "parcela" : "parcelas"} ·{" "}
                  <span className="font-semibold text-nexus-bright">
                    {formatBRL(totalSelecionado)}
                  </span>
                </span>
              ) : (
                <span className="text-white/30">Nenhuma selecionada</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleGerar}
                disabled={selecionadas.size === 0 || isPending}
                className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {isPending ? "Gerando…" : "Gerar Fatura"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
