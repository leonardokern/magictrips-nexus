"use client"

import { useEffect, useState, useTransition } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  const [step, setStep] = useState<1 | 2>(1)
  const [clienteId, setClienteId] = useState("")
  const [parcelas, setParcelas] = useState<ParcelaParaFatura[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [loadingParcelas, setLoadingParcelas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Aviso de fatura duplicada — bloqueia a geração e oferece link pra existente.
  const [faturaDuplicada, setFaturaDuplicada] = useState<{
    id: string
    numero: string | null
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Ajustes financeiros — desconto + "juros/multa" (campo único). Mantém
  // % e R$ linkados: editar um dispara o cálculo do outro com base no
  // subtotal das parcelas selecionadas. Strings vazias = "não tocado".
  //
  // Decisão jun/2026: Juros e Multa aparecem combinados em um único
  // campo no modal e em uma única linha no PDF. Persistência usa as
  // colunas `juros_*` (multa fica em 0). Se no futuro precisar separar,
  // a coluna multa já existe.
  const [descontoPctStr, setDescontoPctStr] = useState("")
  const [descontoValStr, setDescontoValStr] = useState("")
  const [jurosMultaPctStr, setJurosMultaPctStr] = useState("")
  const [jurosMultaValStr, setJurosMultaValStr] = useState("")

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
    setStep(1)
    setClienteId("")
    setParcelas([])
    setSelecionadas(new Set())
    setError(null)
    setFaturaDuplicada(null)
    setDescontoPctStr("")
    setDescontoValStr("")
    setJurosMultaPctStr("")
    setJurosMultaValStr("")
    onClose()
  }

  // Avançar do passo 1 (picker) pro passo 2 (ajustes).
  // Bloqueia se não houver parcelas selecionadas. Quando o usuário muda
  // de parcelas e volta ao passo 2, os ajustes em % recalculam pelo novo
  // subtotal automaticamente (ver useEffect abaixo).
  function avancarParaAjustes() {
    if (selecionadas.size === 0) {
      setError("Selecione ao menos uma parcela.")
      return
    }
    setError(null)
    setStep(2)
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
      // Pré-seleciona todas as parcelas pendentes
      setSelecionadas(new Set(data.map((p) => p.id)))
    } finally {
      setLoadingParcelas(false)
    }
  }

  function toggleParcela(id: string) {
    // Mudar a seleção invalida o aviso de duplicada — o conjunto exato pode
    // ter virado um diferente que não bate com nenhuma fatura existente.
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

  // ── Ajustes (desconto / juros / multa) ─────────────────────────────────
  // Parser tolerante: aceita "12,5", "12.5" e "1.234,56" (pt-BR com milhar).
  function parseNumStr(s: string): number {
    if (!s.trim()) return 0
    // Remove ponto de milhar e troca vírgula decimal por ponto.
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

  // Máscara estilo calculadora: os dígitos digitados são tratados como
  // centavos (últimos 2). Ex.: "5" → "0,05"; "5123" → "51,23"; "451439" → "4.514,39".
  // Não permite "limpar e re-digitar" só a parte inteira — fica sempre com 2 decimais.
  function aplicarMascara(raw: string): { display: string; valor: number } {
    const digitos = raw.replace(/\D/g, "")
    if (!digitos) return { display: "", valor: 0 }
    const valor = parseInt(digitos, 10) / 100
    return { display: formatNumStr(valor), valor }
  }

  /** Atualiza par (% → R$). Chamado quando o operador edita o campo de %. */
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
  /** Atualiza par (R$ → %). Chamado quando o operador edita o campo de R$. */
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
          // Juros/Multa virou campo único na UI — persiste em `juros_*`;
          // `multa_*` fica em 0. O PDF soma os dois pra exibir, então
          // dados antigos com multa preenchida continuam exibindo a soma.
          jurosPercentual: parseNumStr(jurosMultaPctStr),
          jurosValor: jurosMultaVal,
          multaPercentual: 0,
          multaValor: 0,
        },
      })
      if (!result.ok) {
        if (result.fatura_existente_id) {
          // Já existe fatura com EXATAMENTE essas parcelas. NÃO geramos outra.
          // Bloqueia o botão e exibe aviso com link pra abrir a existente —
          // operador decide se quer abrir a antiga, mudar de parcelas ou cancelar.
          setFaturaDuplicada({
            id: result.fatura_existente_id,
            numero: result.fatura_existente_numero ?? null,
          })
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
        <DialogHeader className="shrink-0 space-y-3 border-b border-white/[0.06] px-6 py-4">
          {/* Linha do título — `pr-8` cede espaço pro X de fechar do Radix. */}
          <DialogTitle className="flex items-center gap-2 pr-8 text-base">
            <Receipt className="h-4 w-4 text-nexus-bright" />
            Gerar Fatura
          </DialogTitle>
          {/* Stepper centralizado: bola numerada + label, conectados por linha.
              Passo 1 concluído vira check verde quando o usuário avança. */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  step === 1
                    ? "bg-nexus-bright text-white shadow-[0_0_0_3px_rgba(20,152,213,0.15)]"
                    : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                ].join(" ")}
              >
                {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
              </span>
              <span
                className={[
                  "text-xs font-medium transition-colors",
                  step === 1 ? "text-white" : "text-white/55",
                ].join(" ")}
              >
                Parcelas
              </span>
            </div>
            <div
              className={[
                "h-px w-10 transition-colors",
                step === 2 ? "bg-nexus-bright/40" : "bg-white/10",
              ].join(" ")}
            />
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  step === 2
                    ? "bg-nexus-bright text-white shadow-[0_0_0_3px_rgba(20,152,213,0.15)]"
                    : "border border-white/10 bg-white/[0.04] text-white/40",
                ].join(" ")}
              >
                2
              </span>
              <span
                className={[
                  "text-xs font-medium transition-colors",
                  step === 2 ? "text-white" : "text-white/40",
                ].join(" ")}
              >
                Ajustes
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <>
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

            </>
          )}

          {step === 2 && (
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              {/* Subtotal vs Total final */}
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

              {/* Linhas de ajuste — Juros/Multa (campo único) e Desconto.
                  Cada linha: label · input% · input R$ */}
              <AjusteRow
                label="Juros/Multa"
                pctStr={jurosMultaPctStr}
                valStr={jurosMultaValStr}
                tone="acrescimo"
                onChangePct={(v) =>
                  onChangePct(v, setJurosMultaPctStr, setJurosMultaValStr)
                }
                onChangeVal={(v) =>
                  onChangeVal(v, setJurosMultaPctStr, setJurosMultaValStr)
                }
              />
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

          {/* Aviso de duplicada — bloqueia "Gerar Fatura" até o operador
              mudar a seleção ou cancelar. Inclui link pra abrir a existente. */}
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

        {/* Footer sticky — botões mudam conforme o passo */}
        <div className="shrink-0 border-t border-white/[0.06] bg-card/95 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {selecionadas.size > 0 ? (
                <span className="text-white/70">
                  <span className="font-semibold text-white">{selecionadas.size}</span>{" "}
                  {selecionadas.size === 1 ? "parcela" : "parcelas"} ·{" "}
                  <span className="font-semibold text-nexus-bright">
                    {step === 2
                      ? formatBRL(totalFinal)
                      : formatBRL(totalSelecionado)}
                  </span>
                </span>
              ) : (
                <span className="text-white/30">Nenhuma selecionada</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step === 1 ? (
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
                    onClick={avancarParaAjustes}
                    disabled={selecionadas.size === 0 || isPending}
                    className="gap-1.5 bg-nexus-bright text-white hover:bg-nexus-bright/90"
                  >
                    Avançar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setStep(1)
                    }}
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

// ─── Subcomponente ───────────────────────────────────────────────────────────

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
  /** "acrescimo" pinta o ícone em vermelho (juros/multa); "abate" em verde (desconto). */
  tone: "acrescimo" | "abate"
  onChangePct: (v: string) => void
  onChangeVal: (v: string) => void
}) {
  const accent =
    tone === "acrescimo"
      ? "text-rose-300"
      : "text-emerald-300"
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <label className={`col-span-3 text-xs font-medium ${accent}`}>
        {label}
      </label>
      <div className="col-span-4 relative">
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
      <div className="col-span-5 relative">
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
