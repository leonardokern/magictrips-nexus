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
import { DateInput } from "@/components/ui/date-input"
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
import {
  COBRANCA_TIPO_LABEL,
  type CobrancaTipo,
} from "@/lib/schemas/venda"
import { cn } from "@/lib/utils"
import { VendaOriginalPreviewCard } from "./venda-original-preview-card"
import {
  listarVendasParaAlteracao,
  obterVendaParaAlteracao,
  criarAlteracaoVenda,
  getDadosAlteracao,
  type DadosAlteracao,
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
/**
 * Item de cobrança adicional na alteração. O cliente só pode INCLUIR
 * cobranças novas — as originais permanecem intactas. O fluxo é equivalente
 * a registrar um recebimento extra referente ao delta de receita.
 */
type CobrancaAdicionalState = {
  uiKey: string
  tipo: CobrancaTipo
  valorStr: string
  numParcelas: number
  plataforma: "PagSeguro" | "Cielo" | ""
  /** Data de pagamento de cada parcela (ISO YYYY-MM-DD ou ""). Sempre tem
   *  exatamente `numParcelas` posições; ao mudar o nº de parcelas, é
   *  redimensionado preservando o que foi preenchido. */
  parcelasDatas: string[]
}

/**
 * Soma `meses` meses a uma data ISO YYYY-MM-DD, preservando o dia quando
 * possível (clipa pro último dia do mês se o destino não comportar).
 */
function adicionarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1 + meses, 1)
  const ultimoDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  const dia = Math.min(d, ultimoDia)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

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
  /** Datas de viagem (ISO YYYY-MM-DD ou ""). Alteráveis pra produtos
   *  existentes ou novos. Mudança de data conta como alteração mesmo sem
   *  delta financeiro. */
  novaDataInicioViagem: string
  novaDataFimViagem: string
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
  const [observacoes, setObservacoes] = useState("")
  const [cobrancasExtras, setCobrancasExtras] = useState<
    CobrancaAdicionalState[]
  >([])
  // Override de cliente / origem (vazio = mantém o da original).
  // `clienteId === null` significa "não alterado" — a venda usa o da original.
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [origem, setOrigem] = useState<string | null>(null)
  const [dadosAlteracao, setDadosAlteracao] = useState<DadosAlteracao | null>(
    null,
  )
  const [isSubmitting, startSubmit] = useTransition()

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setView({ kind: "picker" })
      setVendaSelecionadaId(null)
      setPreview(null)
      setProdutos([])
      setObservacoes("")
      setCobrancasExtras([])
      setClienteId(null)
      setOrigem(null)
      setDadosAlteracao(null)
    }
  }, [open])

  function adicionarCobranca() {
    setCobrancasExtras((arr) => [
      ...arr,
      {
        uiKey: crypto.randomUUID(),
        tipo: "pix",
        valorStr: "",
        numParcelas: 1,
        plataforma: "",
        parcelasDatas: [""],
      },
    ])
  }

  function removerCobranca(uiKey: string) {
    setCobrancasExtras((arr) => arr.filter((c) => c.uiKey !== uiKey))
  }

  function atualizarCobranca(
    uiKey: string,
    patch: Partial<CobrancaAdicionalState>,
  ) {
    setCobrancasExtras((arr) =>
      arr.map((c) => {
        if (c.uiKey !== uiKey) return c
        const merged = { ...c, ...patch }
        // Quando numParcelas muda, redimensiona o array de datas preservando
        // as posições já preenchidas. Posições novas começam vazias.
        if (patch.numParcelas != null && patch.numParcelas !== c.numParcelas) {
          const n = Math.max(1, patch.numParcelas)
          const existentes = merged.parcelasDatas ?? []
          merged.parcelasDatas = Array.from(
            { length: n },
            (_, i) => existentes[i] ?? "",
          )
        }
        return merged
      }),
    )
  }

  /**
   * Mexe na data de uma parcela específica. Quando o usuário preenche a
   * primeira parcela, preenche automaticamente as seguintes com a mesma
   * data + 1 mês cada — mesmo padrão do Step 3 da venda regular.
   */
  function atualizarParcelaData(uiKey: string, idx: number, data: string) {
    setCobrancasExtras((arr) =>
      arr.map((c) => {
        if (c.uiKey !== uiKey) return c
        const datas = [...c.parcelasDatas]
        datas[idx] = data
        if (idx === 0 && data) {
          for (let i = 1; i < datas.length; i++) {
            // Só auto-preenche posições vazias — não sobrescreve datas que
            // o usuário ajustou manualmente.
            if (!datas[i]) datas[i] = adicionarMeses(data, i)
          }
        }
        return { ...c, parcelasDatas: datas }
      }),
    )
  }

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
        novaDataInicioViagem: p.data_inicio_viagem ?? "",
        novaDataFimViagem: p.data_fim_viagem ?? "",
        removido: false,
      })),
    )
    setClienteId(venda.cliente_id)
    setOrigem(venda.origem)
    setView({ kind: "form", venda })
    // Carrega dados de comissão em paralelo (não bloqueia a abertura do form;
    // se demorar, o select de origem fica disabled brevemente).
    getDadosAlteracao(venda.id).then((r) => {
      if (r.ok && r.data) setDadosAlteracao(r.data)
    })
  }

  /**
   * Recalcula a comissão_percentual usando a mesma hierarquia do wizard:
   *  1. usuarios.comissao_percentual (override fixo, ex: Jéssica 12%)
   *  2. perfis_comissoes (perfil + origem)
   *  3. comissoes_regras (empresa + origem)
   *  4. origens_venda.comissao_percentual (default da origem)
   * Quando nenhum bate, retorna `null` — server cai no valor da venda
   * original ao processar o RPC.
   */
  function calcularComissao(origemNome: string | null): number | null {
    if (!dadosAlteracao || !origemNome) return null
    const { agente, origens, perfisComissoes, comissoesRegras } = dadosAlteracao
    if (agente?.comissao_percentual != null) return Number(agente.comissao_percentual)
    const origemObj = origens.find((o) => o.nome === origemNome)
    if (!origemObj) return null
    if (agente?.perfil_id) {
      const overridePerfil = perfisComissoes.find(
        (p) => p.perfil_id === agente.perfil_id && p.origem_id === origemObj.id,
      )
      if (overridePerfil) return Number(overridePerfil.percentual)
    }
    const regra = comissoesRegras.find((r) => r.origem_id === origemObj.id)
    if (regra) return Number(regra.percentual)
    if (origemObj.comissao_percentual != null) return Number(origemObj.comissao_percentual)
    return null
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
    campo:
      | "novoValorVendaStr"
      | "novoValorCustoStr"
      | "novoRavStr"
      | "novaDataInicioViagem"
      | "novaDataFimViagem",
    valor: string,
  ) {
    setProdutos((arr) =>
      arr.map((p) => {
        if (p.uiKey !== uiKey) return p
        const novo = { ...p, [campo]: valor }

        // Auto-cálculo financeiro — mesma regra do wizard de venda:
        //  • Venda ou Custo mudam → RAV = Venda - Custo
        //  • RAV muda → Custo = Venda - RAV
        //  • Valor de venda nunca é preenchido pelo sistema
        if (campo === "novoValorVendaStr" || campo === "novoValorCustoStr") {
          const venda = parseValorComSoma(novo.novoValorVendaStr)
          const custo = parseValorComSoma(novo.novoValorCustoStr)
          const diff = venda - custo
          novo.novoRavStr =
            Number.isFinite(diff) && Math.abs(diff) >= 0.005
              ? diff.toFixed(2).replace(".", ",")
              : ""
        } else if (campo === "novoRavStr") {
          const venda = parseValorComSoma(novo.novoValorVendaStr)
          const rav = parseValorComSoma(valor)
          // Só recalcula custo se venda > 0 e RAV foi preenchido. Se RAV
          // for limpo, mantém o custo intacto.
          if (venda > 0 && valor.trim() !== "") {
            const novoCusto = Math.max(0, venda - rav)
            novo.novoValorCustoStr = novoCusto.toFixed(2).replace(".", ",")
          }
        }

        return novo
      }),
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

      // Mudança de datas conta como alteração mesmo sem delta financeiro.
      const dataInicioOriginal = original?.data_inicio_viagem ?? ""
      const dataFimOriginal = original?.data_fim_viagem ?? ""
      const dataInicioNova = p.removido ? "" : p.novaDataInicioViagem
      const dataFimNova = p.removido ? "" : p.novaDataFimViagem
      const datasMudaram =
        dataInicioNova !== dataInicioOriginal ||
        dataFimNova !== dataFimOriginal

      // Linha sem alteração nenhuma → não envia.
      if (
        deltaVenda === 0 &&
        deltaCusto === 0 &&
        deltaRav === 0 &&
        !datasMudaram
      ) {
        continue
      }

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
        // Datas absolutas — a alteração armazena o novo valor desejado
        // (não delta). Vazio = null no banco.
        data_inicio_viagem: dataInicioNova || null,
        data_fim_viagem: dataFimNova || null,
        pgto_modo: original?.pgto_modo ?? "comissionado",
        pgto_num_parcelas: 1,
        pgto_entrada: 0,
        pgto_primeira_parcela_extra: 0,
      })
    }

    // Constrói a cobrança adicional (opcional) — só envia se houver itens
    // com valor > 0. Cada item tem que ter os campos mínimos validados.
    let cobrancaPayload: Record<string, unknown> | null = null
    if (cobrancasExtras.length > 0) {
      const itensValidos: Record<string, unknown>[] = []
      for (const c of cobrancasExtras) {
        const valor = parseValorComSoma(c.valorStr)
        if (valor <= 0) {
          toast.error("Cada cobrança adicional precisa de valor maior que zero.")
          return
        }
        if (c.tipo === "link_externo" && !c.plataforma) {
          toast.error("Selecione a plataforma do link externo.")
          return
        }
        // Toda parcela precisa de data — vale tanto pra single (1 data) quanto
        // pra parcelado (N datas, uma por parcela).
        if (c.parcelasDatas.length !== c.numParcelas) {
          toast.error("Datas das parcelas inconsistentes.")
          return
        }
        for (let i = 0; i < c.numParcelas; i++) {
          if (!c.parcelasDatas[i]) {
            toast.error(
              c.numParcelas > 1
                ? `Informe a data da parcela ${i + 1}.`
                : "Informe a data de pagamento.",
            )
            return
          }
        }
        // Distribui o valor igualmente entre as parcelas (centavos sobram
        // na última pra fechar exato).
        const valorPorParcela = Number((valor / c.numParcelas).toFixed(2))
        const parcelasDetalhe = c.parcelasDatas.map((data, i) => ({
          ordem: i + 1,
          valor:
            i === c.numParcelas - 1
              ? Number((valor - valorPorParcela * (c.numParcelas - 1)).toFixed(2))
              : valorPorParcela,
          data,
        }))
        itensValidos.push({
          tipo: c.tipo,
          valor_total: valor,
          num_parcelas: c.numParcelas,
          valor_parcela: c.numParcelas > 1 ? valorPorParcela : null,
          plataforma_link: null,
          plataforma: c.tipo === "link_externo" ? c.plataforma : null,
          parcelas_detalhe: parcelasDetalhe,
          taxa_adquirente: null,
          valor_liquido: null,
          data_inicio: c.parcelasDatas[0] ?? null,
          data_primeiro_recebimento: c.parcelasDatas[0] ?? null,
          fornecedor_destino: null,
          observacoes: null,
        })
      }
      const total = itensValidos.reduce(
        (acc, it) => acc + Number(it.valor_total ?? 0),
        0,
      )
      cobrancaPayload = {
        valor_total: total,
        observacoes: null,
        itens: itensValidos,
      }
    }

    // Overrides de cliente / origem / comissão: só enviamos quando MUDOU
    // em relação à venda original — assim o RPC herda o resto.
    const clienteMudou = clienteId != null && clienteId !== venda.cliente_id
    const origemMudou = origem != null && origem !== venda.origem
    const novaComissao = origemMudou ? calcularComissao(origem) : null

    // Mudança vale também quando o operador trocou cliente OU origem,
    // mesmo sem mexer em produto/cobrança — caso clássico: lead Magic
    // virou indicação própria do agente (origem muda, comissão muda).
    if (
      produtosPayload.length === 0 &&
      !cobrancaPayload &&
      !clienteMudou &&
      !origemMudou
    ) {
      toast.error("Nenhuma alteração detectada.")
      return
    }

    const payload = {
      venda_original_id: venda.id,
      observacoes: observacoes.trim() || null,
      produtos: produtosPayload,
      cobranca: cobrancaPayload,
      cliente_id: clienteMudou ? clienteId : null,
      origem: origemMudou ? origem : null,
      comissao_percentual: origemMudou ? novaComissao : null,
    }

    startSubmit(async () => {
      const r = await criarAlteracaoVenda(payload)
      if (!r.ok) {
        toast.error(r.error ?? "Erro ao criar alteração.")
        return
      }
      toast.success("Alteração registrada. Aguardando aprovação.")
      onOpenChange(false)
      router.push("/vendas")
      router.refresh()
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
              onRemover={removerLinha}
              onAtualizar={atualizarCampo}
              observacoes={observacoes}
              setObservacoes={setObservacoes}
              cobrancasExtras={cobrancasExtras}
              onAdicionarCobranca={adicionarCobranca}
              onRemoverCobranca={removerCobranca}
              onAtualizarCobranca={atualizarCobranca}
              onAtualizarParcelaData={atualizarParcelaData}
              clienteId={clienteId}
              setClienteId={setClienteId}
              origem={origem}
              setOrigem={setOrigem}
              dadosAlteracao={dadosAlteracao}
              comissaoCalculada={calcularComissao(origem)}
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

/**
 * Placeholder de Select enquanto `getDadosAlteracao` ainda não retornou.
 * Tem a MESMA altura/bordas do `SelectTrigger` real pra não causar reflow
 * quando os dados chegam, exibe o valor atual à esquerda e um spinner +
 * "Carregando…" à direita — sinalizando que vai ficar editável.
 */
function SelectLoadingPlaceholder({ text }: { text: string }) {
  return (
    <div
      aria-busy="true"
      className="flex h-10 items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 text-sm text-white/55"
    >
      <span className="truncate">{text}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/45">
        <Spinner className="h-3 w-3" />
        Carregando…
      </span>
    </div>
  )
}

function FormView({
  venda,
  produtos,
  onRemover,
  onAtualizar,
  observacoes,
  setObservacoes,
  cobrancasExtras,
  onAdicionarCobranca,
  onRemoverCobranca,
  onAtualizarCobranca,
  onAtualizarParcelaData,
  clienteId,
  setClienteId,
  origem,
  setOrigem,
  dadosAlteracao,
  comissaoCalculada,
}: {
  venda: VendaOriginalCompleta
  produtos: ProdutoEditavelState[]
  onRemover: (uiKey: string) => void
  onAtualizar: (
    uiKey: string,
    campo:
      | "novoValorVendaStr"
      | "novoValorCustoStr"
      | "novoRavStr"
      | "novaDataInicioViagem"
      | "novaDataFimViagem",
    valor: string,
  ) => void
  observacoes: string
  setObservacoes: (s: string) => void
  cobrancasExtras: CobrancaAdicionalState[]
  onAdicionarCobranca: () => void
  onRemoverCobranca: (uiKey: string) => void
  onAtualizarCobranca: (
    uiKey: string,
    patch: Partial<CobrancaAdicionalState>,
  ) => void
  onAtualizarParcelaData: (uiKey: string, idx: number, data: string) => void
  clienteId: string | null
  setClienteId: (v: string | null) => void
  origem: string | null
  setOrigem: (v: string | null) => void
  dadosAlteracao: DadosAlteracao | null
  comissaoCalculada: number | null
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
            Agente
          </p>
          <p className="text-sm text-white/85">{venda.agente.nome}</p>
        </div>
      </div>

      {/* Cliente + Origem — editáveis. Quando origem muda, a comissão é
          recalculada automaticamente pela mesma hierarquia do wizard
          (usuario.comissao → perfis_comissoes → comissoes_regras → default
          da origem). Enquanto `dadosAlteracao` não chegou, mostramos
          placeholders desabilitados com spinner — assim fica claro que os
          campos vão ficar editáveis em instantes. */}
      <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/55">
            Cliente
          </Label>
          {dadosAlteracao ? (
            <Select
              value={clienteId ?? venda.cliente_id}
              onValueChange={(v) => setClienteId(v)}
            >
              <SelectTrigger className="h-10 border-white/10 bg-white/[0.04]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dadosAlteracao.clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <SelectLoadingPlaceholder text={venda.cliente.nome} />
          )}
          {clienteId && clienteId !== venda.cliente_id && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.04] px-2.5 py-1.5">
              <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
              <p className="text-[11px] text-amber-200/90">
                Cliente alterado{" · "}
                <span className="text-white/45 line-through decoration-white/20">
                  {venda.cliente.nome}
                </span>
              </p>
            </div>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/55">
            Origem do lead
          </Label>
          {dadosAlteracao ? (
            <Select
              value={origem ?? venda.origem ?? undefined}
              onValueChange={(v) => setOrigem(v)}
            >
              <SelectTrigger className="h-10 border-white/10 bg-white/[0.04]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dadosAlteracao.origens.map((o) => (
                  <SelectItem key={o.id} value={o.nome}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <SelectLoadingPlaceholder text={venda.origem ?? "—"} />
          )}
          {origem && origem !== venda.origem && (
            <div className="mt-2 flex flex-col gap-1 rounded-md border border-amber-300/20 bg-amber-300/[0.04] px-2.5 py-1.5">
              <p className="flex items-center gap-2 text-[11px] text-amber-200/90">
                <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                Origem alterada{" · "}
                <span className="text-white/45 line-through decoration-white/20">
                  {venda.origem ?? "—"}
                </span>
              </p>
              {comissaoCalculada != null && (
                <p className="ml-3.5 text-[11px] text-white/65">
                  Comissão recalculada:{" "}
                  <span className="tabular-nums text-white/45">
                    {Number(venda.comissao_percentual ?? 0)
                      .toFixed(2)
                      .replace(".", ",")}
                    %
                  </span>{" "}
                  <span className="text-white/35">→</span>{" "}
                  <strong className="font-semibold tabular-nums text-amber-300">
                    {comissaoCalculada.toFixed(2).replace(".", ",")}%
                  </strong>
                </p>
              )}
            </div>
          )}
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

            const dataInicioOriginal = original?.data_inicio_viagem ?? ""
            const dataFimOriginal = original?.data_fim_viagem ?? ""
            const datasMudaram =
              !p.removido &&
              (p.novaDataInicioViagem !== dataInicioOriginal ||
                p.novaDataFimViagem !== dataFimOriginal)
            return (
              <li
                key={p.uiKey}
                className={cn(
                  "px-4 py-3",
                  p.removido && "opacity-50",
                )}
              >
                <div className="grid grid-cols-12 items-center gap-2">
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
                    invertido
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
                </div>

                {/* Sub-linha — datas de viagem editáveis. Original em legenda
                    abaixo de cada campo, no mesmo padrão das colunas de valor. */}
                <div className="mt-3 grid grid-cols-12 gap-2">
                  <div className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Datas da viagem
                  </div>
                  <div className="col-span-4">
                    <DataCell
                      label="Início"
                      original={dataInicioOriginal}
                      novo={p.novaDataInicioViagem}
                      disabled={p.removido}
                      mudou={datasMudaram && p.novaDataInicioViagem !== dataInicioOriginal}
                      onChange={(v) =>
                        onAtualizar(p.uiKey, "novaDataInicioViagem", v)
                      }
                    />
                  </div>
                  <div className="col-span-4">
                    <DataCell
                      label="Fim"
                      original={dataFimOriginal}
                      novo={p.novaDataFimViagem}
                      disabled={p.removido}
                      mudou={datasMudaram && p.novaDataFimViagem !== dataFimOriginal}
                      onChange={(v) =>
                        onAtualizar(p.uiKey, "novaDataFimViagem", v)
                      }
                    />
                  </div>
                  <div className="col-span-1" />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Resumo dos deltas */}
      <div className="grid gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3 sm:grid-cols-3">
        <DeltaResumo label="Δ Receita" valor={resumo.delta_venda} />
        <DeltaResumo label="Δ Custo" valor={resumo.delta_custo} invertido />
        <DeltaResumo label="Δ RAV" valor={resumo.delta_rav} />
      </div>

      {/* Cobranças adicionais — opcional. Não substitui as cobranças da
          venda original; apenas registra recebimentos extras referentes ao
          delta de receita desta alteração. */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-white">
              Cobranças adicionais{" "}
              <span className="text-xs font-normal text-white/45">
                (opcional)
              </span>
            </p>
            <p className="text-[11px] text-white/40">
              Registre o recebimento da diferença. Não altera as cobranças
              originais.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdicionarCobranca}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adicionar cobrança
          </Button>
        </div>

        {cobrancasExtras.length === 0 ? (
          <p className="px-4 py-4 text-center text-xs text-white/35">
            Nenhuma cobrança adicional registrada.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {cobrancasExtras.map((c) => (
              <li key={c.uiKey} className="grid grid-cols-12 gap-3 px-4 py-3">
                <div className="col-span-12 sm:col-span-3">
                  <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
                    Tipo
                  </Label>
                  <Select
                    value={c.tipo}
                    onValueChange={(v) =>
                      onAtualizarCobranca(c.uiKey, {
                        tipo: v as CobrancaTipo,
                        // Limpa plataforma se sair de link_externo
                        plataforma:
                          v === "link_externo" ? c.plataforma : "",
                      })
                    }
                  >
                    <SelectTrigger className="h-9 border-white/10 bg-white/[0.04] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    {/* Mesmos tipos do Step 3 da venda regular — sem
                        cartao_debito/transferencia/dinheiro. */}
                    <SelectContent>
                      <SelectItem value="pix">{COBRANCA_TIPO_LABEL["pix"]}</SelectItem>
                      <SelectItem value="boleto">{COBRANCA_TIPO_LABEL["boleto"]}</SelectItem>
                      <SelectItem value="cartao_credito">
                        {COBRANCA_TIPO_LABEL["cartao_credito"]}
                      </SelectItem>
                      <SelectItem value="faturado">
                        {COBRANCA_TIPO_LABEL["faturado"]}
                      </SelectItem>
                      <SelectItem value="link_externo">
                        {COBRANCA_TIPO_LABEL["link_externo"]}
                      </SelectItem>
                      <SelectItem value="outro">{COBRANCA_TIPO_LABEL["outro"]}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
                    Valor
                  </Label>
                  <CurrencyInput
                    value={c.valorStr}
                    onChange={(v) =>
                      onAtualizarCobranca(c.uiKey, { valorStr: v })
                    }
                    placeholder="0,00"
                  />
                </div>

                <div className="col-span-6 sm:col-span-2">
                  <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
                    Parcelas
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={c.numParcelas}
                    onChange={(e) =>
                      onAtualizarCobranca(c.uiKey, {
                        numParcelas: Math.max(
                          1,
                          Math.min(36, Number(e.target.value) || 1),
                        ),
                      })
                    }
                    className="h-9 border-white/10 bg-white/[0.04] text-sm"
                  />
                </div>

                {c.tipo === "link_externo" ? (
                  <div className="col-span-10 sm:col-span-3">
                    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
                      Plataforma *
                    </Label>
                    <Select
                      value={c.plataforma || undefined}
                      onValueChange={(v) =>
                        onAtualizarCobranca(c.uiKey, {
                          plataforma: v as "PagSeguro" | "Cielo",
                        })
                      }
                    >
                      <SelectTrigger className="h-9 border-white/10 bg-white/[0.04] text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PagSeguro">PagSeguro</SelectItem>
                        <SelectItem value="Cielo">Cielo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="col-span-10 sm:col-span-3" />
                )}

                <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => onRemoverCobranca(c.uiKey)}
                    title="Remover cobrança"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/55 transition-colors hover:bg-white/[0.07]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Datas — em 1 parcela mostra um único campo "Data de
                    pagamento". Em N parcelas, lista N campos (auto-preenche
                    mensal a partir da primeira). */}
                {c.numParcelas === 1 ? (
                  <div className="col-span-12 sm:col-span-6">
                    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
                      Data de pagamento *
                    </Label>
                    <DateInput
                      value={c.parcelasDatas[0] ?? ""}
                      onChange={(v) => onAtualizarParcelaData(c.uiKey, 0, v)}
                    />
                  </div>
                ) : (
                  <div className="col-span-12">
                    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
                      Datas das parcelas *
                    </Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {c.parcelasDatas.map((data, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                        >
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-white/45">
                            Parc. {i + 1}
                          </span>
                          <div className="flex-1">
                            <DateInput
                              value={data}
                              onChange={(v) =>
                                onAtualizarParcelaData(c.uiKey, i, v)
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
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
  invertido,
  onChange,
}: {
  original: number
  novoStr: string
  delta: number
  disabled?: boolean
  /** Para custo: + é ruim (vermelho) e - é bom (verde). Para venda/RAV
   *  vale o oposto (default). */
  invertido?: boolean
  onChange: (v: string) => void
}) {
  // Sinal "positivo bom" — em venda/RAV é delta > 0; em custo, delta < 0.
  const positivoBom = invertido ? delta < 0 : delta > 0
  const deltaColor =
    delta === 0
      ? "text-white/30"
      : positivoBom
        ? "text-emerald-300"
        : "text-rose-300"
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
            deltaColor,
          )}
        >
          <span>Δ</span>
          <span>{delta === 0 ? "—" : formatBRL(delta)}</span>
        </div>
      </div>
    </div>
  )
}

function DataCell({
  label,
  original,
  novo,
  disabled,
  mudou,
  onChange,
}: {
  label: string
  original: string
  novo: string
  disabled?: boolean
  mudou: boolean
  onChange: (v: string) => void
}) {
  const formatDate = (iso: string) => {
    if (!iso) return "—"
    const [y, m, d] = iso.split("-")
    return d && m && y ? `${d}/${m}/${y}` : iso
  }
  return (
    <div className="space-y-1">
      <DateInput value={novo} onChange={onChange} disabled={disabled} />
      <div className="space-y-0.5 px-1 text-[10px] tabular-nums">
        <div className="flex items-center justify-between gap-1 text-white/35">
          <span>{label} (orig)</span>
          <span>{formatDate(original)}</span>
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-1 font-medium",
            mudou ? "text-amber-300" : "text-white/30",
          )}
        >
          <span>Δ</span>
          <span>{mudou ? formatDate(novo) : "—"}</span>
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
