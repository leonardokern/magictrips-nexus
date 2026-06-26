"use client"

import { useEffect, useState, useTransition } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  CheckSquare,
  FileText,
  Loader2,
  Receipt,
  Square,
} from "lucide-react"
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
  getUltimaFaturaComAtrasos,
  criarFatura,
  type ClienteComParcelas,
  type ParcelaParaFatura,
  type UltimaFaturaAtrasos,
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

// ─── Utilitários de máscara (nível de módulo, compartilhados pelos subcomponentes) ───

function parseNumStr(s: string): number {
  if (!s.trim()) return 0
  const limpo = s.replace(/\./g, "").replace(",", ".")
  const n = parseFloat(limpo)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function formatNumStr(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ""
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function aplicarMascara(raw: string): { display: string; valor: number } {
  const digitos = raw.replace(/\D/g, "")
  if (!digitos) return { display: "", valor: 0 }
  const valor = parseInt(digitos, 10) / 100
  return { display: formatNumStr(valor), valor }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  clientes: ClienteComParcelas[]
  initialClienteId?: string
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GerarFaturaModal({
  open,
  onClose,
  clientes,
  initialClienteId,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Passo 1
  const [clienteId, setClienteId] = useState("")
  const [parcelas, setParcelas] = useState<ParcelaParaFatura[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [loadingParcelas, setLoadingParcelas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [faturaDuplicada, setFaturaDuplicada] = useState<{
    id: string
    numero: string | null
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Passo 2 — última fatura paga com atrasos
  const [ultimaFatura, setUltimaFatura] = useState<
    UltimaFaturaAtrasos | null | "loading"
  >(null)
  const [jurosParcelasPct, setJurosParcelasPct] = useState<
    Record<string, string>
  >({})

  // Passo 3 — ajustes: juros como valor, desconto como % + R$
  const [descontoPctStr, setDescontoPctStr] = useState("")
  const [descontoValStr, setDescontoValStr] = useState("")
  const [jurosMultaValStr, setJurosMultaValStr] = useState("")

  useEffect(() => {
    if (!open) return
    if (!initialClienteId) return
    if (clienteId === initialClienteId) return
    handleClienteChange(initialClienteId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialClienteId])

  function handleClose() {
    setStep(1)
    setClienteId("")
    setParcelas([])
    setSelecionadas(new Set())
    setError(null)
    setFaturaDuplicada(null)
    setUltimaFatura(null)
    setJurosParcelasPct({})
    setDescontoPctStr("")
    setDescontoValStr("")
    setJurosMultaValStr("")
    onClose()
  }

  async function handleClienteChange(id: string) {
    setClienteId(id)
    setSelecionadas(new Set())
    setError(null)
    setFaturaDuplicada(null)
    if (!id) { setParcelas([]); return }
    setLoadingParcelas(true)
    try {
      const data = await getParcelasPendentesDoCliente(id)
      setParcelas(data)
      setSelecionadas(new Set(data.map((p) => p.id)))
    } finally {
      setLoadingParcelas(false)
    }
  }

  function toggleParcela(id: string) {
    setFaturaDuplicada(null)
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas() {
    setFaturaDuplicada(null)
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

  // ── Ajustes (desconto / juros) ─────────────────────────────────────────────

  function onChangePct(
    rawPct: string,
    setPct: (s: string) => void,
    setVal: (s: string) => void,
  ) {
    const { display, valor: pct } = aplicarMascara(rawPct)
    setPct(display)
    const valor = totalSelecionado > 0 ? (totalSelecionado * pct) / 100 : 0
    setVal(formatNumStr(Number(valor.toFixed(2))))
  }

  function onChangeVal(
    rawVal: string,
    setPct: (s: string) => void,
    setVal: (s: string) => void,
  ) {
    const { display, valor: val } = aplicarMascara(rawVal)
    setVal(display)
    const pct = totalSelecionado > 0 ? (val / totalSelecionado) * 100 : 0
    setPct(formatNumStr(Number(pct.toFixed(2))))
  }

  const descontoVal = parseNumStr(descontoValStr)
  const jurosMultaVal = parseNumStr(jurosMultaValStr)
  const totalFinal = Number(
    (totalSelecionado - descontoVal + jurosMultaVal).toFixed(2),
  )

  // Total de juros calculado no passo 2 (derivado do estado)
  const totalJurosParcelas =
    ultimaFatura && ultimaFatura !== "loading"
      ? ultimaFatura.parcelas_atraso.reduce((sum, p) => {
          const pct = parseNumStr(jurosParcelasPct[p.id] ?? "")
          return sum + (p.valor * pct) / 100
        }, 0)
      : 0

  // ── Navegação entre passos ─────────────────────────────────────────────────

  async function avancarParaAtrasos() {
    if (selecionadas.size === 0) {
      setError("Selecione ao menos uma parcela.")
      return
    }
    setError(null)
    setUltimaFatura("loading")
    setStep(2)
    const data = await getUltimaFaturaComAtrasos(clienteId)
    setUltimaFatura(data)
  }

  function avancarParaAjustes() {
    // Pré-preenche o campo de juros do passo 3 com o total calculado no passo 2
    const uf =
      ultimaFatura && ultimaFatura !== "loading" ? ultimaFatura : null
    if (uf && totalJurosParcelas > 0) {
      setJurosMultaValStr(formatNumStr(Number(totalJurosParcelas.toFixed(2))))
    }
    setError(null)
    setStep(3)
  }

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
        ajustes: {
          descontoPercentual: parseNumStr(descontoPctStr),
          descontoValor: descontoVal,
          jurosPercentual: 0,
          jurosValor: jurosMultaVal,
          multaPercentual: 0,
          multaValor: 0,
        },
      })
      if (!result.ok) {
        if (result.fatura_existente_id) {
          setFaturaDuplicada({
            id: result.fatura_existente_id,
            numero: result.fatura_existente_numero ?? null,
          })
        } else {
          setError(result.error)
        }
        return
      }
      window.open(`/api/faturas/${result.fatura.id}/pdf`, "_blank", "noopener")
      handleClose()
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-3 border-b border-white/[0.06] px-6 py-4">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base">
            <Receipt className="h-4 w-4 text-nexus-bright" />
            Gerar Fatura
          </DialogTitle>

          {/* Stepper 3 passos */}
          <div className="flex items-center justify-center gap-2">
            {/* Passo 1 */}
            <StepBubble n={1} currentStep={step} label="Parcelas" />
            <StepConnector active={step >= 2} />
            {/* Passo 2 */}
            <StepBubble n={2} currentStep={step} label="Atrasos" />
            <StepConnector active={step >= 3} />
            {/* Passo 3 */}
            <StepBubble n={3} currentStep={step} label="Ajustes" />
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {/* ── Passo 1: Parcelas ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
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
            </>
          )}

          {/* ── Passo 2: Atrasos da última fatura ─────────────────────────── */}
          {step === 2 && (
            <>
              {ultimaFatura === "loading" && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              )}

              {ultimaFatura === null && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
                  <p className="text-sm text-white/55">
                    Nenhuma fatura paga encontrada para este cliente.
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    Não há histórico de atrasos a sinalizar.
                  </p>
                </div>
              )}

              {ultimaFatura && ultimaFatura !== "loading" && (
                <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  {/* Cabeçalho da última fatura */}
                  <div className="text-xs text-white/55">
                    Última fatura paga:{" "}
                    <span className="font-mono text-white">
                      {ultimaFatura.numero_display}
                    </span>
                    {" · paga em "}
                    <span className="text-white/80">
                      {formatDateBr(ultimaFatura.data_pagamento)}
                    </span>
                  </div>

                  {ultimaFatura.parcelas_atraso.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-300/80">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Nenhuma parcela foi paga com atraso.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {ultimaFatura.parcelas_atraso.length === 1
                          ? "1 parcela paga com atraso"
                          : `${ultimaFatura.parcelas_atraso.length} parcelas pagas com atraso`}
                      </div>

                      <div className="space-y-3">
                        {ultimaFatura.parcelas_atraso.map((p) => (
                          <div
                            key={p.id}
                            className="space-y-2 border-t border-white/[0.04] pt-3 first:border-0 first:pt-0"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm text-white">
                                {p.venda_identificador
                                  ? `${p.venda_identificador} — Parc. ${p.numero}/${p.total_parcelas}`
                                  : p.descricao ?? `Parcela ${p.numero}/${p.total_parcelas}`}
                              </span>
                              <span className="shrink-0 tabular-nums text-sm font-semibold text-white">
                                {formatBRL(p.valor)}
                              </span>
                            </div>
                            <div className="text-[11px] text-white/45">
                              Venc.{" "}
                              <span className="text-rose-300/70">
                                {formatDateBr(p.data_vencimento)}
                              </span>
                              {" · Pago "}
                              {formatDateBr(p.data_pagamento)}
                            </div>
                            <JurosPorParcelaRow
                              valor={p.valor}
                              pctStr={jurosParcelasPct[p.id] ?? ""}
                              onChange={(v) =>
                                setJurosParcelasPct((prev) => ({
                                  ...prev,
                                  [p.id]: v,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>

                      {/* Total de juros acumulado */}
                      <div className="flex items-center justify-between border-t border-white/[0.04] pt-3 text-xs">
                        <span className="text-white/55">
                          Total de juros a acrescentar
                        </span>
                        <span
                          className={[
                            "tabular-nums font-semibold",
                            totalJurosParcelas > 0
                              ? "text-rose-300"
                              : "text-white/30",
                          ].join(" ")}
                        >
                          {formatBRL(totalJurosParcelas)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Passo 3: Ajustes finais ────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              {/* Subtotal + Total */}
              <div className="space-y-1 border-b border-white/[0.04] pb-2.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-white/55">Subtotal das parcelas</span>
                  <span className="tabular-nums text-white/85">
                    {formatBRL(totalSelecionado)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-white">Total final</span>
                  <span className="font-semibold tabular-nums text-nexus-bright">
                    {formatBRL(totalFinal)}
                  </span>
                </div>
              </div>

              {/* Juros/Multa — apenas valor R$ */}
              <ValorOnlyRow
                label="Juros/Multa"
                valStr={jurosMultaValStr}
                tone="acrescimo"
                onChange={(v) => {
                  const { display } = aplicarMascara(v)
                  setJurosMultaValStr(display)
                }}
              />

              {/* Desconto — % e R$ linkados */}
              <AjusteRow
                label="Desconto"
                pctStr={descontoPctStr}
                valStr={descontoValStr}
                tone="abate"
                onChangePct={(v) =>
                  onChangePct(v, setDescontoPctStr, setDescontoValStr)
                }
                onChangeVal={(v) =>
                  onChangeVal(v, setDescontoPctStr, setDescontoValStr)
                }
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          {faturaDuplicada && (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-sm">
              <p className="font-medium text-amber-300">
                Já existe uma fatura com exatamente essas parcelas.
              </p>
              <p className="text-xs text-amber-200/70">
                Não é possível gerar uma nova com a mesma seleção. Abra a fatura existente
                {faturaDuplicada.numero ? ` (${faturaDuplicada.numero})` : ""} ou ajuste
                as parcelas selecionadas.
              </p>
              <a
                href={`/api/faturas/${faturaDuplicada.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
              >
                <FileText className="h-3.5 w-3.5" />
                Abrir fatura existente
              </a>
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div className="shrink-0 border-t border-white/[0.06] bg-card/95 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {selecionadas.size > 0 ? (
                <span className="text-white/70">
                  <span className="font-semibold text-white">
                    {selecionadas.size}
                  </span>{" "}
                  {selecionadas.size === 1 ? "parcela" : "parcelas"} ·{" "}
                  <span className="font-semibold text-nexus-bright">
                    {step === 3
                      ? formatBRL(totalFinal)
                      : formatBRL(totalSelecionado)}
                  </span>
                </span>
              ) : (
                <span className="text-white/30">Nenhuma selecionada</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 1 && (
                <>
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
                    onClick={avancarParaAtrasos}
                    disabled={selecionadas.size === 0 || isPending}
                    className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90"
                  >
                    Avançar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setError(null); setStep(1) }}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    size="sm"
                    onClick={avancarParaAjustes}
                    disabled={ultimaFatura === "loading" || isPending}
                    className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90"
                  >
                    Avançar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {step === 3 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setError(null); setStep(2) }}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGerar}
                    disabled={
                      selecionadas.size === 0 || isPending || !!faturaDuplicada
                    }
                    title={
                      faturaDuplicada
                        ? "Já existe fatura com essas parcelas — ajuste a seleção"
                        : undefined
                    }
                    className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {isPending ? "Gerando…" : "Gerar Fatura"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function StepBubble({
  n,
  currentStep,
  label,
}: {
  n: 1 | 2 | 3
  currentStep: 1 | 2 | 3
  label: string
}) {
  const done = currentStep > n
  const active = currentStep === n
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
          active
            ? "bg-nexus-bright text-white shadow-[0_0_0_3px_rgba(20,152,213,0.15)]"
            : done
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border border-white/10 bg-white/[0.04] text-white/40",
        ].join(" ")}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span
        className={[
          "text-xs font-medium transition-colors",
          active ? "text-white" : done ? "text-white/55" : "text-white/40",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  )
}

function StepConnector({ active }: { active: boolean }) {
  return (
    <div
      className={[
        "h-px w-8 transition-colors",
        active ? "bg-nexus-bright/40" : "bg-white/10",
      ].join(" ")}
    />
  )
}

function JurosPorParcelaRow({
  valor,
  pctStr,
  onChange,
}: {
  valor: number
  pctStr: string
  onChange: (v: string) => void
}) {
  const { valor: pct } = aplicarMascara(pctStr)
  const jurosCalc = (valor * pct) / 100

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-rose-300/80">Juros</span>
      <div className="relative w-24">
        <input
          type="text"
          inputMode="decimal"
          value={pctStr}
          onChange={(e) => {
            const { display } = aplicarMascara(e.target.value)
            onChange(display)
          }}
          placeholder="0,00"
          className="h-7 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 pr-5 text-right text-xs tabular-nums text-white focus:border-rose-400/40 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40">
          %
        </span>
      </div>
      {pct > 0 ? (
        <span className="text-xs tabular-nums text-rose-300">
          = {formatBRL(jurosCalc)}
        </span>
      ) : (
        <span className="text-xs text-white/25">= R$ 0,00</span>
      )}
    </div>
  )
}

function ValorOnlyRow({
  label,
  valStr,
  tone,
  onChange,
}: {
  label: string
  valStr: string
  tone: "acrescimo" | "abate"
  onChange: (v: string) => void
}) {
  const accent = tone === "acrescimo" ? "text-rose-300" : "text-emerald-300"
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <label className={`col-span-4 text-xs font-medium ${accent}`}>
        {label}
      </label>
      <div className="col-span-4" />
      <div className="relative col-span-4">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/40">
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={valStr}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-2 text-right text-xs tabular-nums text-white focus:border-nexus-bright/40 focus:outline-none"
        />
      </div>
    </div>
  )
}

function AjusteRow({
  label,
  pctStr,
  valStr,
  tone,
  onChangePct,
  onChangeVal,
}: {
  label: string
  pctStr: string
  valStr: string
  tone: "acrescimo" | "abate"
  onChangePct: (v: string) => void
  onChangeVal: (v: string) => void
}) {
  const accent = tone === "acrescimo" ? "text-rose-300" : "text-emerald-300"
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <label className={`col-span-3 text-xs font-medium ${accent}`}>
        {label}
      </label>
      <div className="relative col-span-4">
        <input
          type="text"
          inputMode="decimal"
          value={pctStr}
          onChange={(e) => onChangePct(e.target.value)}
          placeholder="0,00"
          className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 pr-6 text-right text-xs tabular-nums text-white focus:border-nexus-bright/40 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/40">
          %
        </span>
      </div>
      <div className="relative col-span-5">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/40">
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={valStr}
          onChange={(e) => onChangeVal(e.target.value)}
          placeholder="0,00"
          className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] pl-7 pr-2 text-right text-xs tabular-nums text-white focus:border-nexus-bright/40 focus:outline-none"
        />
      </div>
    </div>
  )
}
