"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ModalLoader } from "@/components/ui/modal-loader"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatBRL, parseValorComSoma } from "@/lib/utils/sum-parser"
import { cn } from "@/lib/utils"
import { VendaOriginalPreviewCard } from "./venda-original-preview-card"
import {
  listarVendasParaAlteracao,
  listarTiposProduto,
  obterVendaParaAlteracao,
  criarAlteracaoVenda,
  type TipoProdutoOption,
  type VendaOriginalCompleta,
  type VendaParaAlteracao,
} from "@/app/(dashboard)/vendas/actions-alteracao"

type View =
  | { kind: "picker" }
  | { kind: "form"; venda: VendaOriginalCompleta }

/**
 * Estado do preview inline que aparece logo abaixo do combobox enquanto
 * o usuário ainda está na view de picker. Nada selecionado → null.
 * Selecionando → 'carregando'. Carregado → 'pronto' com os dados.
 */
type PreviewState =
  | null
  | { kind: "carregando" }
  | { kind: "pronto"; venda: VendaOriginalCompleta }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Estado de UM produto editável na alteração.
 * - Para produtos existentes: `originalIndex` aponta pro índice na venda
 *   original, `novoValorVenda`/`novoValorCusto`/`novoRav` são os valores
 *   ABSOLUTOS digitados pelo agente. Delta = novo - original.
 * - Para produtos novos (adicionados): `originalIndex = null`,
 *   delta = valor digitado.
 * - Para remover: marca `removido = true`, delta = -original.
 */
type ProdutoEditavelState = {
  /** UUID local pra key do React */
  uiKey: string
  originalIndex: number | null
  /** Quando é novo produto, escolhe tipo_produto manualmente.
   *  Quando é existente, herda do original e fica imutável. */
  tipoProdutoId: string
  tipoProdutoNome: string
  novoValorVendaStr: string
  novoValorCustoStr: string
  novoRavStr: string
  removido: boolean
}

export function AlteracaoValoresModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>({ kind: "picker" })
  const [vendaSelecionadaId, setVendaSelecionadaId] = useState<string | null>(
    null,
  )
  const [preview, setPreview] = useState<PreviewState>(null)
  const [produtos, setProdutos] = useState<ProdutoEditavelState[]>([])
  const [tiposProduto, setTiposProduto] = useState<TipoProdutoOption[]>([])
  const [novoTipoProdutoId, setNovoTipoProdutoId] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [isSubmitting, startSubmit] = useTransition()

  // Carrega a lista de tipos de produto ativos do sistema — usada no
  // seletor "Adicionar produto" do Step 2. Cacheia enquanto o modal estiver
  // aberto; recarrega na próxima abertura.
  useEffect(() => {
    if (!open) return
    listarTiposProduto().then((r) => {
      if (r.ok && r.data) setTiposProduto(r.data)
    })
  }, [open])

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setView({ kind: "picker" })
      setVendaSelecionadaId(null)
      setPreview(null)
      setProdutos([])
      setNovoTipoProdutoId("")
      setObservacoes("")
    }
  }, [open])

  function selecionarVenda(venda: VendaParaAlteracao | null) {
    if (!venda) {
      setVendaSelecionadaId(null)
      setPreview(null)
      return
    }
    setVendaSelecionadaId(venda.id)
    setPreview({ kind: "carregando" })
    obterVendaParaAlteracao(venda.id).then((r) => {
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao carregar venda.")
        setPreview(null)
        setVendaSelecionadaId(null)
        return
      }
      if (!r.data) {
        toast.error("Erro ao carregar venda.")
        setPreview(null)
        setVendaSelecionadaId(null)
        return
      }
      setPreview({ kind: "pronto", venda: r.data })
    })
  }

  function iniciarAlteracao(venda: VendaOriginalCompleta) {
    // Hidrata produtos com valores absolutos da original (já como string PT-BR)
    setProdutos(
      venda.produtos.map((p, i) => ({
        uiKey: crypto.randomUUID(),
        originalIndex: i,
        tipoProdutoId: p.tipo_produto_id,
        tipoProdutoNome: p.tipo_produto_nome,
        novoValorVendaStr: numToStr(Number(p.valor_venda ?? 0)),
        novoValorCustoStr: numToStr(Number(p.valor_custo ?? 0)),
        novoRavStr: numToStr(Number(p.rav ?? 0)),
        removido: false,
      })),
    )
    setView({ kind: "form", venda })
  }

  function adicionarProduto(venda: VendaOriginalCompleta) {
    void venda
    if (!novoTipoProdutoId) {
      toast.error("Selecione um tipo de produto.")
      return
    }
    const tipo = tiposProduto.find((t) => t.id === novoTipoProdutoId)
    if (!tipo) {
      toast.error("Tipo de produto não encontrado.")
      return
    }
    setProdutos((arr) => [
      ...arr,
      {
        uiKey: crypto.randomUUID(),
        originalIndex: null,
        tipoProdutoId: tipo.id,
        tipoProdutoNome: tipo.nome,
        novoValorVendaStr: "",
        novoValorCustoStr: "",
        novoRavStr: "",
        removido: false,
      },
    ])
    setNovoTipoProdutoId("")
  }

  function removerLinha(uiKey: string) {
    setProdutos((arr) =>
      arr
        .map((p) => {
          if (p.uiKey !== uiKey) return p
          // Produto novo: remove de fato.
          if (p.originalIndex === null) return null
          // Produto da original: marca como removido (delta = -original).
          return { ...p, removido: !p.removido }
        })
        .filter((p): p is ProdutoEditavelState => p !== null),
    )
  }

  function atualizarCampo(
    uiKey: string,
    campo: "novoValorVendaStr" | "novoValorCustoStr" | "novoRavStr",
    valor: string,
  ) {
    setProdutos((arr) =>
      arr.map((p) => (p.uiKey === uiKey ? { ...p, [campo]: valor } : p)),
    )
  }

  function submeter(venda: VendaOriginalCompleta) {
    // Calcula deltas e monta payload
    const produtosPayload: Array<Record<string, unknown>> = []

    for (let i = 0; i < produtos.length; i++) {
      const p = produtos[i]!
      const original =
        p.originalIndex !== null ? venda.produtos[p.originalIndex] : null

      let deltaVenda: number
      let deltaCusto: number
      let deltaRav: number

      if (p.removido && original) {
        deltaVenda = -Number(original.valor_venda ?? 0)
        deltaCusto = -Number(original.valor_custo ?? 0)
        deltaRav = -Number(original.rav ?? 0)
      } else {
        const novoVenda = parseValorComSoma(p.novoValorVendaStr)
        const novoCusto = parseValorComSoma(p.novoValorCustoStr)
        const novoRav = parseValorComSoma(p.novoRavStr)
        const baseVenda = original ? Number(original.valor_venda ?? 0) : 0
        const baseCusto = original ? Number(original.valor_custo ?? 0) : 0
        const baseRav = original ? Number(original.rav ?? 0) : 0
        deltaVenda = Number((novoVenda - baseVenda).toFixed(2))
        deltaCusto = Number((novoCusto - baseCusto).toFixed(2))
        deltaRav = Number((novoRav - baseRav).toFixed(2))
      }

      // Linha sem alteração → não envia (delta zero em tudo)
      if (deltaVenda === 0 && deltaCusto === 0 && deltaRav === 0) continue

      produtosPayload.push({
        ordem: i + 1,
        tipo_produto_id: p.tipoProdutoId,
        fornecedor_id: original?.fornecedor_id ?? null,
        fornecedor_nome: original?.fornecedor_nome ?? "",
        valor_venda: deltaVenda,
        valor_custo: deltaCusto,
        rav: deltaRav,
        rav_extra_cliente: 0,
        rav_extra_fornecedor: 0,
        valores_extras: {},
        pgto_modo: original?.pgto_modo ?? "comissionado",
        pgto_num_parcelas: 1,
        pgto_entrada: 0,
        pgto_primeira_parcela_extra: 0,
      })
    }

    if (produtosPayload.length === 0) {
      toast.error("Nenhuma alteração de valores detectada.")
      return
    }

    const payload = {
      venda_original_id: venda.id,
      observacoes: observacoes.trim() || null,
      produtos: produtosPayload,
      cobranca: null,
    }

    startSubmit(async () => {
      const r = await criarAlteracaoVenda(payload)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao criar alteração.")
        return
      }
      toast.success("Alteração registrada. Aguardando aprovação.")
      onOpenChange(false)
      router.push(`/vendas/${r.data!.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/[0.06] px-6 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-amber-300" />
            Alteração de venda
          </DialogTitle>
          <DialogDescription>
            {view.kind === "picker" &&
              "Selecione a venda aprovada que terá os valores ajustados."}
            {view.kind === "form" &&
              "Ajuste os valores. O sistema registrará apenas as diferenças."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view.kind === "picker" && (
            <PickerView
              vendaSelecionadaId={vendaSelecionadaId}
              onSelect={selecionarVenda}
              preview={preview}
            />
          )}

          {view.kind === "form" && (
            <FormView
              venda={view.venda}
              produtos={produtos}
              tiposProduto={tiposProduto}
              novoTipoProdutoId={novoTipoProdutoId}
              setNovoTipoProdutoId={setNovoTipoProdutoId}
              onAdicionar={() => adicionarProduto(view.venda)}
              onRemover={removerLinha}
              onAtualizar={atualizarCampo}
              observacoes={observacoes}
              setObservacoes={setObservacoes}
            />
          )}
        </div>

        {/* Footer com botões de navegação */}
        <div className="shrink-0 border-t border-white/[0.06] bg-card/40 px-6 py-3">
          {view.kind === "picker" && (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-nexus-bright text-white hover:bg-nexus-bright-soft"
                disabled={preview?.kind !== "pronto"}
                onClick={() => {
                  if (preview?.kind === "pronto") iniciarAlteracao(preview.venda)
                }}
              >
                Iniciar alteração
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {view.kind === "form" && (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setView({ kind: "picker" })}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar
              </Button>
              <Button
                type="button"
                className="bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => submeter(view.venda)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Registrar alteração
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subviews
// ─────────────────────────────────────────────────────────────────────────────

function PickerView({
  vendaSelecionadaId,
  onSelect,
  preview,
}: {
  vendaSelecionadaId: string | null
  onSelect: (venda: VendaParaAlteracao | null) => void
  preview: PreviewState
}) {
  const [query, setQuery] = useState("")
  const [vendas, setVendas] = useState<VendaParaAlteracao[]>([])
  const [isPending, startTransition] = useTransition()

  // Busca server-side com debounce — só dispara com termo de 2+ caracteres
  // pra evitar carregar a base inteira (e pra que o estado vazio seja
  // explicitamente "digite pra buscar").
  const queryTrim = query.trim()
  const hasQuery = queryTrim.length >= 2

  useEffect(() => {
    if (!hasQuery) {
      setVendas([])
      return
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await listarVendasParaAlteracao(queryTrim)
        if (r.ok && r.data) setVendas(r.data)
      })
    }, 250)
    return () => clearTimeout(t)
  }, [queryTrim, hasQuery])

  // Quando uma venda está selecionada, mostra o preview + botão "Trocar".
  // Quando nada selecionado, mostra a lista clicável.
  if (vendaSelecionadaId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/55">Venda selecionada</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(null)}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Trocar venda
          </Button>
        </div>

        {preview?.kind === "carregando" && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-10">
            <ModalLoader label="Carregando venda original…" />
          </div>
        )}

        {preview?.kind === "pronto" && (
          <VendaOriginalPreviewCard venda={preview.venda} />
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Label className="mb-2 block text-sm">Venda original</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por identificador (MT-XXXX) ou nome do cliente"
            className="h-10 border-white/10 bg-white/[0.04] pl-9 text-sm"
          />
        </div>
        <p className="mt-2 text-xs text-white/45">
          Digite pelo menos 2 caracteres pra buscar entre vendas aprovadas.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        {!hasQuery ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Search className="h-6 w-6 text-white/20" />
            <p className="text-sm text-white/45">
              Comece digitando o identificador (MT-XXXX) ou o nome do cliente.
            </p>
          </div>
        ) : isPending ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="text-white/40" />
          </div>
        ) : vendas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/45">
            Nenhuma venda aprovada encontrada para &ldquo;{queryTrim}&rdquo;.
          </p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-white/[0.04] overflow-y-auto">
            {vendas.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-nexus-bright/30 bg-nexus-bright/10">
                    <Receipt className="h-3.5 w-3.5 text-nexus-bright" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm">
                      <span className="font-mono text-xs font-semibold text-nexus-bright">
                        {v.identificador}
                      </span>
                      <span className="truncate font-medium text-white">
                        {v.cliente_nome}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-white/45">
                      {v.empresa_nome} · {formatDateBr(v.data_venda)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-white/75">
                    {formatBRL(v.valor_total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function formatDateBr(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function FormView({
  venda,
  produtos,
  tiposProduto,
  novoTipoProdutoId,
  setNovoTipoProdutoId,
  onAdicionar,
  onRemover,
  onAtualizar,
  observacoes,
  setObservacoes,
}: {
  venda: VendaOriginalCompleta
  produtos: ProdutoEditavelState[]
  tiposProduto: TipoProdutoOption[]
  novoTipoProdutoId: string
  setNovoTipoProdutoId: (s: string) => void
  onAdicionar: () => void
  onRemover: (uiKey: string) => void
  onAtualizar: (
    uiKey: string,
    campo: "novoValorVendaStr" | "novoValorCustoStr" | "novoRavStr",
    valor: string,
  ) => void
  observacoes: string
  setObservacoes: (s: string) => void
}) {
  // Computa totais e deltas em runtime pra exibir o resumo
  const resumo = useMemo(() => {
    let totalDeltaVenda = 0
    let totalDeltaCusto = 0
    let totalDeltaRav = 0
    for (const p of produtos) {
      const original =
        p.originalIndex !== null ? venda.produtos[p.originalIndex] : null
      if (p.removido && original) {
        totalDeltaVenda -= Number(original.valor_venda ?? 0)
        totalDeltaCusto -= Number(original.valor_custo ?? 0)
        totalDeltaRav -= Number(original.rav ?? 0)
      } else {
        const baseVenda = original ? Number(original.valor_venda ?? 0) : 0
        const baseCusto = original ? Number(original.valor_custo ?? 0) : 0
        const baseRav = original ? Number(original.rav ?? 0) : 0
        totalDeltaVenda +=
          parseValorComSoma(p.novoValorVendaStr) - baseVenda
        totalDeltaCusto +=
          parseValorComSoma(p.novoValorCustoStr) - baseCusto
        totalDeltaRav += parseValorComSoma(p.novoRavStr) - baseRav
      }
    }
    return {
      delta_venda: Number(totalDeltaVenda.toFixed(2)),
      delta_custo: Number(totalDeltaCusto.toFixed(2)),
      delta_rav: Number(totalDeltaRav.toFixed(2)),
    }
  }, [produtos, venda])

  return (
    <div className="space-y-5">
      {/* Header com identificador da original */}
      <div className="flex items-center justify-between rounded-xl border border-nexus-bright/20 bg-nexus-bright/[0.04] px-4 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Alteração de
          </p>
          <p className="font-mono text-sm font-semibold text-white">
            {venda.identificador}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Cliente · Agente
          </p>
          <p className="text-sm text-white/85">
            {venda.cliente.nome} · {venda.agente.nome}
          </p>
        </div>
      </div>

      {/* Tabela de produtos */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="grid grid-cols-12 gap-2 border-b border-white/[0.06] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          <div className="col-span-3">Produto</div>
          <div className="col-span-3 text-right">Venda (novo)</div>
          <div className="col-span-3 text-right">Custo (novo)</div>
          <div className="col-span-2 text-right">RAV (novo)</div>
          <div className="col-span-1" />
        </div>
        <ul className="divide-y divide-white/[0.04]">
          {produtos.map((p) => {
            const original =
              p.originalIndex !== null ? venda.produtos[p.originalIndex] : null
            const baseVenda = original ? Number(original.valor_venda ?? 0) : 0
            const baseCusto = original ? Number(original.valor_custo ?? 0) : 0
            const baseRav = original ? Number(original.rav ?? 0) : 0
            const novoVenda = p.removido
              ? 0
              : parseValorComSoma(p.novoValorVendaStr)
            const novoCusto = p.removido
              ? 0
              : parseValorComSoma(p.novoValorCustoStr)
            const novoRav = p.removido ? 0 : parseValorComSoma(p.novoRavStr)
            const dVenda = p.removido ? -baseVenda : novoVenda - baseVenda
            const dCusto = p.removido ? -baseCusto : novoCusto - baseCusto
            const dRav = p.removido ? -baseRav : novoRav - baseRav

            return (
              <li
                key={p.uiKey}
                className={cn(
                  "grid grid-cols-12 items-center gap-2 px-4 py-3",
                  p.removido && "opacity-50",
                )}
              >
                <div className="col-span-3 min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {p.tipoProdutoNome}
                    {p.originalIndex === null && (
                      <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                        novo
                      </span>
                    )}
                    {p.removido && (
                      <span className="ml-2 inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-300">
                        remover
                      </span>
                    )}
                  </p>
                  {original && (
                    <p className="text-[11px] text-white/45">
                      {original.fornecedor_nome || "—"}
                    </p>
                  )}
                </div>

                <div className="col-span-3">
                  <ValorCell
                    original={baseVenda}
                    novoStr={p.novoValorVendaStr}
                    delta={dVenda}
                    disabled={p.removido}
                    onChange={(v) =>
                      onAtualizar(p.uiKey, "novoValorVendaStr", v)
                    }
                  />
                </div>
                <div className="col-span-3">
                  <ValorCell
                    original={baseCusto}
                    novoStr={p.novoValorCustoStr}
                    delta={dCusto}
                    disabled={p.removido}
                    onChange={(v) =>
                      onAtualizar(p.uiKey, "novoValorCustoStr", v)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <ValorCell
                    original={baseRav}
                    novoStr={p.novoRavStr}
                    delta={dRav}
                    disabled={p.removido}
                    onChange={(v) => onAtualizar(p.uiKey, "novoRavStr", v)}
                  />
                </div>

                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onRemover(p.uiKey)}
                    title={
                      p.removido
                        ? "Desfazer remoção"
                        : p.originalIndex === null
                          ? "Excluir linha nova"
                          : "Marcar como removido"
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/55 transition-colors hover:bg-white/[0.07]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Adicionar produto — só aceita tipos cadastrados no sistema
            (não permite texto livre). */}
        <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.015] px-4 py-3">
          <Select
            value={novoTipoProdutoId}
            onValueChange={setNovoTipoProdutoId}
          >
            <SelectTrigger className="h-9 border-white/10 bg-white/[0.04] text-sm">
              <SelectValue placeholder="Adicionar produto: selecione o tipo…" />
            </SelectTrigger>
            <SelectContent>
              {tiposProduto.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-white/45">
                  Carregando tipos…
                </div>
              ) : (
                tiposProduto.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdicionar}
            disabled={!novoTipoProdutoId}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Resumo dos deltas */}
      <div className="grid gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3 sm:grid-cols-3">
        <DeltaResumo label="Δ Receita" valor={resumo.delta_venda} />
        <DeltaResumo label="Δ Custo" valor={resumo.delta_custo} invertido />
        <DeltaResumo label="Δ RAV" valor={resumo.delta_rav} />
      </div>

      {/* Observações */}
      <div>
        <Label htmlFor="alt-obs" className="mb-2 block text-sm">
          Observações (opcional)
        </Label>
        <Textarea
          id="alt-obs"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: cliente solicitou bagagem extra; fornecedor cobrou taxa adicional…"
          rows={2}
          className="border-white/10 bg-white/[0.04] text-sm"
        />
      </div>
    </div>
  )
}

function ValorCell({
  original,
  novoStr,
  delta,
  disabled,
  onChange,
}: {
  original: number
  novoStr: string
  delta: number
  disabled?: boolean
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <CurrencyInput
        value={novoStr}
        onChange={onChange}
        disabled={disabled}
        placeholder="0,00"
      />
      {/* Legenda compacta: stack vertical em duas linhas com label curta
          à esquerda e valor tabular à direita. Evita wrap em colunas
          estreitas (RAV col-span-2). */}
      <div className="space-y-0.5 px-1 text-[10px] tabular-nums">
        <div className="flex items-center justify-between gap-1 text-white/35">
          <span>orig</span>
          <span>{formatBRL(original)}</span>
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-1 font-medium",
            delta > 0
              ? "text-emerald-300"
              : delta < 0
                ? "text-amber-300"
                : "text-white/30",
          )}
        >
          <span>Δ</span>
          <span>{delta === 0 ? "—" : formatBRL(delta)}</span>
        </div>
      </div>
    </div>
  )
}

function DeltaResumo({
  label,
  valor,
  invertido,
}: {
  label: string
  valor: number
  /** Se true, semântica invertida: + é ruim (custo), - é bom. */
  invertido?: boolean
}) {
  const positivoBom = invertido ? valor < 0 : valor > 0
  const color =
    valor === 0
      ? "text-white/45"
      : positivoBom
        ? "text-emerald-300"
        : "text-amber-300"
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </span>
      <span className={cn("text-base font-semibold tabular-nums", color)}>
        {valor === 0
          ? "Sem mudança"
          : valor > 0
            ? `+ ${formatBRL(valor)}`
            : `- ${formatBRL(Math.abs(valor))}`}
      </span>
    </div>
  )
}

function numToStr(n: number): string {
  if (n === 0) return ""
  return n.toFixed(2).replace(".", ",")
}
