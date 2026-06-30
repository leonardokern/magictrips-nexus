import type { Metadata } from "next"
import { TrendingDown } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatBRL } from "@/lib/utils/sum-parser"
import { formatDateBr } from "@/lib/utils/formatters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KpiCard } from "@/components/financeiro/kpi-card"
import { FinanceFilters } from "@/components/financeiro/finance-filters"
import {
  ParcelaStatusBadge,
  type ParcelaStatus,
} from "@/components/financeiro/parcela-status-badge"
import { MarcarPagoButton } from "@/components/financeiro/marcar-pago-button"
import { VerVendaLink } from "@/components/vendas/ver-venda-link"
import Link from "next/link"
import { Tag } from "lucide-react"
import { NovaSaidaButton } from "@/components/financeiro/nova-saida-modal"
import { LancamentoRowActions } from "@/components/financeiro/lancamento-row-actions"
import { listarCategorias } from "@/app/(dashboard)/financeiro/actions"
import { getCaixas } from "@/app/(dashboard)/cartoes/actions"

export const metadata: Metadata = { title: "Contas a Pagar" }

type SearchParams = Promise<{
  status?: string
  mes?: string
  q?: string
  cartao?: string
}>

const FORMA_LABEL: Record<string, string> = {
  faturado: "Faturado",
  cartao_agencia: "Cartão agência",
  cliente_fornecedor: "Cliente e Fornecedor",
}

function derivarStatus(
  statusDb: string,
  vencimentoIso: string,
  hoje: string,
  formaPagamento?: string | null,
): ParcelaStatus {
  if (statusDb === "pago") return "pago"
  if (statusDb === "cancelado") return "cancelado"
  // Cartão agência nunca fica "atrasado" — o pagamento ocorre no fechamento da fatura
  if (formaPagamento === "cartao_agencia") return "pendente"
  if (vencimentoIso < hoje) return "atrasado"
  return "pendente"
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function mesAtualISO(): string {
  return new Date().toISOString().slice(0, 7)
}

function rangeDoMes(yyyyMm: string): { from: string; to: string } {
  const [y, m] = yyyyMm.split("-").map(Number)
  if (!y || !m) {
    const now = new Date()
    return rangeDoMes(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    )
  }
  const from = `${y}-${String(m).padStart(2, "0")}-01`
  const ultimoDia = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`
  return { from, to }
}

function formatMesAtualLabel(): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date())
}

export default async function ContasPagarPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver contas a pagar.
      </div>
    )
  }
  const podeEditar = can(user, "financeiro", "editar")

  const sp = await searchParams
  const statusFiltro = sp.status ?? ""
  // Padrão silencioso: sem param de mês → filtra pelo mês atual na query,
  // mas não redireciona (evita loop no "Limpar").
  const mesFiltro = sp.mes ?? mesAtualISO()
  const cartaoFiltro = sp.cartao ?? ""
  const q = (sp.q ?? "").trim()
  const hoje = hojeIso()

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  let queryBase = sb
    .from("parcelas_pagar")
    .select(
      `
      id, numero, total_parcelas, descricao, valor, forma_pagamento,
      data_vencimento, data_pagamento, status, fornecedor_nome, is_manual,
      cartao:cartoes(id, nome),
      caixa:caixas(nome),
      categoria:categorias_financeiras(nome),
      venda_produto:venda_produtos(
        id,
        venda:vendas(id, identificador)
      )
    `,
    )
    .order("data_vencimento", { ascending: true })
    .limit(200)

  if (statusFiltro === "atrasado") {
    queryBase = queryBase.eq("status", "pendente").lt("data_vencimento", hoje)
  } else if (statusFiltro === "pendente") {
    queryBase = queryBase.eq("status", "pendente").gte("data_vencimento", hoje)
  } else if (statusFiltro && statusFiltro !== "all") {
    queryBase = queryBase.eq("status", statusFiltro)
  }

  if (mesFiltro) {
    const { from, to } = rangeDoMes(mesFiltro)
    queryBase = queryBase.gte("data_vencimento", from).lte("data_vencimento", to)
  }

  if (cartaoFiltro) {
    queryBase = queryBase.eq("cartao_id", cartaoFiltro)
  }

  const [{ data: parcelasRaw, error }, caixasList, categorias] = await Promise.all([
    queryBase,
    getCaixas(),
    listarCategorias("pagar"),
  ])

  // Cartões para filtro e modal Nova Saída
  const { data: cartoesRaw } = await supabase
    .from("cartoes")
    .select("id, nome, banco, ativo")
    .order("ativo", { ascending: false })
    .order("nome")
  const cartoesList = (cartoesRaw ?? []) as { id: string; nome: string; banco: string | null; ativo: boolean }[]
  const cartoesAtivos = cartoesList.filter((c) => c.ativo)

  // KPIs — sem filtro de mês/status (visão geral)
  type KpiRow = {
    valor: number | string
    data_vencimento: string
    data_pagamento: string | null
    status: string
  }
  const { data: kpiRows } = await supabase
    .from("parcelas_pagar")
    .select("valor, data_vencimento, data_pagamento, status")

  const kpis = (() => {
    const rows = (kpiRows ?? []) as KpiRow[]
    const mes = mesAtualISO()
    let emAberto = 0
    let atrasado = 0
    let pagoMes = 0
    for (const r of rows) {
      const v = Number(r.valor ?? 0)
      if (r.status === "pendente") {
        emAberto += v
        if (r.data_vencimento < hoje) atrasado += v
      }
      if (r.status === "pago" && r.data_pagamento?.startsWith(mes)) {
        pagoMes += v
      }
    }
    return { emAberto, atrasado, pagoMes }
  })()

  type ParcelaRow = {
    id: string
    numero: number
    total_parcelas: number
    descricao: string | null
    valor: number | string
    forma_pagamento: string | null
    data_vencimento: string
    data_pagamento: string | null
    status: string
    fornecedor_nome: string | null
    is_manual: boolean
    cartao: { id: string; nome: string } | { id: string; nome: string }[] | null
    caixa: { nome: string } | { nome: string }[] | null
    categoria: { nome: string } | { nome: string }[] | null
    venda_produto:
      | {
          id: string
          venda:
            | { id: string; identificador: string }
            | { id: string; identificador: string }[]
            | null
        }
      | {
          id: string
          venda:
            | { id: string; identificador: string }
            | { id: string; identificador: string }[]
            | null
        }[]
      | null
  }
  let parcelas = (parcelasRaw ?? []) as unknown as ParcelaRow[]

  if (q) {
    const qLower = q.toLowerCase()
    parcelas = parcelas.filter((p) =>
      (p.fornecedor_nome ?? "").toLowerCase().includes(qLower),
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <TrendingDown className="h-6 w-6 text-rose-300" />
            Contas a Pagar
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Parcelas devidas aos fornecedores — geradas automaticamente para
            produtos com pagamento <strong>faturado</strong>.
          </p>
        </div>
        {podeEditar && (
          <div className="flex items-center gap-2">
            <Link
              href="/financeiro/categorias?from=pagar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <Tag className="h-4 w-4" />
              Categorias
            </Link>
            <NovaSaidaButton
              categorias={categorias}
              caixas={caixasList}
              cartoes={cartoesList}
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Em aberto"
          value={formatBRL(kpis.emAberto)}
          tone="info"
          hint="Total ainda a pagar"
        />
        <KpiCard
          label="Atrasado"
          value={formatBRL(kpis.atrasado)}
          tone="danger"
          hint="Vencido sem pagamento"
        />
        <KpiCard
          label={`Pago em ${formatMesAtualLabel()}`}
          value={formatBRL(kpis.pagoMes)}
          tone="success"
        />
      </div>

      <FinanceFilters
        placeholderBusca="Buscar por fornecedor…"
        cartoes={cartoesAtivos.map((c) => ({ id: c.id, nome: c.nome }))}
      />

      {error ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
          Erro ao carregar parcelas: {error.message}
        </div>
      ) : parcelas.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-white/55">
            Nenhuma parcela a pagar encontrada com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                <TableHead className="w-[110px]">Vencimento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((p) => {
                const cartao = Array.isArray(p.cartao) ? p.cartao[0] : p.cartao
                const caixaObj = Array.isArray(p.caixa) ? p.caixa[0] : p.caixa
                const catObj = Array.isArray(p.categoria) ? p.categoria[0] : p.categoria
                const vp = Array.isArray(p.venda_produto)
                  ? p.venda_produto[0]
                  : p.venda_produto
                const vnd = vp
                  ? Array.isArray(vp.venda)
                    ? vp.venda[0]
                    : vp.venda
                  : null
                const status = derivarStatus(p.status, p.data_vencimento, hoje, p.forma_pagamento)
                const ehPago = status === "pago"
                const ehAtrasado = status === "atrasado"
                const ehCartaoAgencia = p.forma_pagamento === "cartao_agencia"
                const formaBase = p.forma_pagamento
                  ? FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento
                  : "—"
                const centroCusto = cartao?.nome ?? caixaObj?.nome
                const forma = centroCusto ? `${formaBase} · ${centroCusto}` : formaBase

                return (
                  <TableRow
                    key={p.id}
                    className="border-white/[0.04] hover:bg-white/[0.025]"
                  >
                    <TableCell className="tabular-nums text-sm">
                      <span
                        className={ehAtrasado ? "font-medium text-rose-300" : ""}
                      >
                        {formatDateBr(p.data_vencimento)}
                      </span>
                      {ehPago && p.data_pagamento && (
                        <span className="block text-[10px] text-emerald-300/70">
                          pago {formatDateBr(p.data_pagamento)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-white">
                      {p.is_manual ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white/80">{p.descricao || "—"}</span>
                          {catObj?.nome && (
                            <span className="text-[10px] text-white/40">{catObj.nome}</span>
                          )}
                        </div>
                      ) : (
                        p.fornecedor_nome || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {p.is_manual ? (
                        <span className="rounded border border-rose-500/20 bg-rose-500/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                          Manual
                        </span>
                      ) : vnd?.id && vnd?.identificador ? (
                        <VerVendaLink
                          vendaId={vnd.id}
                          identificador={vnd.identificador}
                          mostraComissao={podeEditar}
                        />
                      ) : (
                        <span className="font-mono text-xs text-white/30">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-white/70">
                      {p.numero}/{p.total_parcelas}
                    </TableCell>
                    <TableCell className="text-xs text-white/70">{forma}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium text-white">
                      {formatBRL(Number(p.valor ?? 0))}
                    </TableCell>
                    <TableCell>
                      {ehCartaoAgencia ? (
                        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/30">
                          Automático
                        </span>
                      ) : (
                        <ParcelaStatusBadge status={status} />
                      )}
                    </TableCell>
                    <TableCell>
                      {podeEditar && status !== "cancelado" && (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Cartão agência: pagamento ocorre no fechamento, sem ação manual */}
                          {!ehCartaoAgencia && (
                            <MarcarPagoButton
                              tipo="pagar"
                              parcelaId={p.id}
                              acao={ehPago ? "pendente" : "pago"}
                              resumo={`Parcela ${p.numero}/${p.total_parcelas} para ${p.fornecedor_nome ?? p.descricao ?? "—"} · ${formatBRL(Number(p.valor ?? 0))}`}
                            />
                          )}
                          {p.is_manual && !ehPago && (
                            <LancamentoRowActions
                              tipo="pagar"
                              parcelaId={p.id}
                              descricao={p.descricao ?? "Lançamento manual"}
                            />
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
