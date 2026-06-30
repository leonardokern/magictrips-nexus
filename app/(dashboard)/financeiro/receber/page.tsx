import type { Metadata } from "next"
import { TrendingUp } from "lucide-react"
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
import { GerarFaturaModalTrigger } from "@/components/financeiro/gerar-fatura-modal-trigger"
import { MarcarParcelaPagaButton } from "@/components/financeiro/marcar-parcela-paga-button"
import { ProrrogarParcelaButton } from "@/components/financeiro/prorrogar-parcela-button"
import { VerVendaLink } from "@/components/vendas/ver-venda-link"
import Link from "next/link"
import { Tag } from "lucide-react"
import { NovaEntradaButton } from "@/components/financeiro/nova-entrada-modal"
import { LancamentoRowActions } from "@/components/financeiro/lancamento-row-actions"
import { AnexoChip } from "@/components/financeiro/anexo-chip"
import { getClientesComParcelasPendentes, listarCategorias } from "@/app/(dashboard)/financeiro/actions"
import { getCaixas } from "@/app/(dashboard)/cartoes/actions"

export const metadata: Metadata = { title: "Contas a Receber" }

type SearchParams = Promise<{
  status?: string
  mes?: string
  q?: string
  caixa?: string
}>

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

function derivarStatus(
  statusDb: string,
  vencimentoIso: string,
  hoje: string,
): ParcelaStatus {
  if (statusDb === "pago") return "pago"
  if (statusDb === "pago_atraso") return "pago_atraso"
  if (statusDb === "cancelado") return "cancelado"
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

export default async function ContasReceberPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver contas a receber.
      </div>
    )
  }
  const podeCriar = can(user, "financeiro", "criar")
  const podeEditar = can(user, "financeiro", "editar")

  const sp = await searchParams
  const statusFiltro = sp.status ?? ""
  const mesFiltro = sp.mes ?? ""
  const caixaFiltro = sp.caixa && sp.caixa !== "all" ? sp.caixa : ""
  const q = (sp.q ?? "").trim()
  const hoje = hojeIso()

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  // Inclui caixa_id (nova coluna) e join caixas (nova tabela) — tipos regenerados pendentes
  let queryBase = sb
    .from("parcelas_receber")
    .select(
      `id, numero, total_parcelas, descricao, valor, forma_pagamento,
      data_vencimento, data_pagamento, status, caixa_id, cartao_id,
      observacoes, data_emissao, categoria_id, is_manual,
      cliente:clientes(id, nome),
      venda:vendas(id, identificador),
      caixa:caixas(nome),
      cartao:cartoes(id, nome),
      categoria:categorias_financeiras(nome),
      lancamento_anexos!lancamento_anexos_parcela_receber_id_fkey(id, nome_arquivo)`,
    )
    .order("data_vencimento", { ascending: true })
    .limit(200)
    .neq("status", "cancelado")

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

  if (caixaFiltro) {
    queryBase = queryBase.eq("caixa_id", caixaFiltro)
  }

  const [{ data: parcelasRaw, error }, { data: kpiRows }, clientesFatura, caixasList, categorias, { data: cartoesRaw }] =
    await Promise.all([
      queryBase,
      supabase
        .from("parcelas_receber")
        .select("valor, data_vencimento, data_pagamento, status"),
      podeCriar ? getClientesComParcelasPendentes() : Promise.resolve([]),
      getCaixas(),
      listarCategorias("receber"),
      supabase.from("cartoes").select("id, nome, banco, ativo").order("ativo", { ascending: false }).order("nome"),
    ])

  const cartoesList = (cartoesRaw ?? []) as { id: string; nome: string; banco: string | null; ativo: boolean }[]

  type KpiRow = {
    valor: number | string
    data_vencimento: string
    data_pagamento: string | null
    status: string
  }

  const kpis = (() => {
    const rows = (kpiRows ?? []) as KpiRow[]
    const mes = mesAtualISO()
    let emAberto = 0
    let atrasado = 0
    let recebidoMes = 0
    for (const r of rows) {
      const v = Number(r.valor ?? 0)
      if (r.status === "pendente") {
        emAberto += v
        if (r.data_vencimento < hoje) atrasado += v
      }
      if ((r.status === "pago" || r.status === "pago_atraso") && r.data_pagamento?.startsWith(mes)) {
        recebidoMes += v
      }
    }
    return { emAberto, atrasado, recebidoMes }
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
    data_emissao: string | null
    status: string
    caixa_id: string | null
    cartao_id: string | null
    categoria_id: string | null
    observacoes: string | null
    is_manual: boolean
    cliente: { id: string; nome: string } | { id: string; nome: string }[] | null
    venda:
      | { id: string; identificador: string }
      | { id: string; identificador: string }[]
      | null
    caixa: { nome: string } | { nome: string }[] | null
    cartao: { id: string; nome: string } | { id: string; nome: string }[] | null
    categoria: { nome: string } | { nome: string }[] | null
    lancamento_anexos: { id: string; nome_arquivo: string }[] | null
  }
  let parcelas = (parcelasRaw ?? []) as unknown as ParcelaRow[]

  if (q) {
    const qLower = q.toLowerCase()
    parcelas = parcelas.filter((p) => {
      const c = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
      return (c?.nome ?? "").toLowerCase().includes(qLower)
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <TrendingUp className="h-6 w-6 text-emerald-300" />
            Contas a Receber
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Parcelas devidas pelos clientes — geradas automaticamente quando a
            venda é aprovada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && (
            <Link
              href="/financeiro/categorias?from=receber"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <Tag className="h-4 w-4" />
              Categorias
            </Link>
          )}
          {podeEditar && (
            <NovaEntradaButton categorias={categorias} caixas={caixasList} cartoes={cartoesList} />
          )}
          {podeCriar && (
            <GerarFaturaModalTrigger clientes={clientesFatura} />
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Em aberto"
          value={formatBRL(kpis.emAberto)}
          tone="info"
          hint="Tudo que ainda não foi pago"
        />
        <KpiCard
          label="Atrasado"
          value={formatBRL(kpis.atrasado)}
          tone="danger"
          hint="Vencido e ainda pendente"
        />
        <KpiCard
          label={`Recebido em ${formatMesAtualLabel()}`}
          value={formatBRL(kpis.recebidoMes)}
          tone="success"
        />
      </div>

      {/* Filtros — cliente (busca) + status + caixa. Mês e presets ficam
          fora desta tela por decisão jun/2026. */}
      <FinanceFilters
        placeholderBusca="Buscar por cliente…"
        showMes={false}
        caixas={caixasList.map((c) => ({ id: c.id, nome: c.nome }))}
      />

      {/* Tabela */}
      {error ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
          Erro ao carregar parcelas: {error.message}
        </div>
      ) : parcelas.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-white/55">
            Nenhuma parcela encontrada com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                <TableHead className="w-[110px]">Vencimento</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[150px]">Pago em</TableHead>
                <TableHead>Status</TableHead>
                {podeEditar && <TableHead className="w-[90px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((p) => {
                const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
                const vnd = Array.isArray(p.venda) ? p.venda[0] : p.venda
                const caixaObj = Array.isArray(p.caixa) ? p.caixa[0] : p.caixa
                const catObj = Array.isArray(p.categoria) ? p.categoria[0] : p.categoria
                const anexos = p.lancamento_anexos ?? []
                const status = derivarStatus(p.status, p.data_vencimento, hoje)
                const ehPago = status === "pago" || status === "pago_atraso"
                const ehAtrasado = status === "atrasado"
                return (
                  <TableRow key={p.id} className="border-white/[0.04] hover:bg-white/[0.025]">
                    <TableCell className="tabular-nums text-sm">
                      <span className={ehAtrasado ? "font-medium text-rose-300" : ""}>
                        {formatDateBr(p.data_vencimento)}
                      </span>
                    </TableCell>
                    {/* Cliente: para manual mostra categoria + descrição; para venda mostra o cliente */}
                    <TableCell className="text-sm text-white">
                      {p.is_manual ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white/70">{catObj?.nome ?? "—"}</span>
                          {p.descricao && (
                            <span className="text-[10px] text-white/35">{p.descricao}</span>
                          )}
                        </div>
                      ) : (cli?.nome ?? "—")}
                    </TableCell>
                    {/* Venda: para manual mostra chip de anexo (se houver); para venda mostra link */}
                    <TableCell>
                      {p.is_manual ? (
                        anexos.length > 0
                          ? <AnexoChip anexos={anexos} />
                          : <span className="font-mono text-xs text-white/30">—</span>
                      ) : vnd?.id && vnd?.identificador ? (
                        <VerVendaLink
                          vendaId={vnd.id}
                          identificador={vnd.identificador}
                          mostraComissao={can(user, "financeiro", "editar")}
                        />
                      ) : (
                        <span className="font-mono text-xs text-white/30">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-white/70">
                      {p.numero}/{p.total_parcelas}
                    </TableCell>
                    <TableCell className="text-xs text-white/70">
                      {p.forma_pagamento ? FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium text-white">
                      {formatBRL(Number(p.valor ?? 0))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ehPago && p.data_pagamento ? (
                        <div className="flex flex-col gap-0.5 tabular-nums">
                          <span className="text-emerald-300">
                            {formatDateBr(p.data_pagamento)}
                          </span>
                          {caixaObj?.nome && (
                            <span className="text-[10px] text-white/55">
                              {caixaObj.nome}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ParcelaStatusBadge status={status} />
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.is_manual && status !== "cancelado" ? (
                            <>
                              {!ehPago && (
                                <MarcarParcelaPagaButton
                                  parcelaId={p.id}
                                  dataVencimento={p.data_vencimento}
                                  valor={Number(p.valor ?? 0)}
                                  caixas={caixasList}
                                />
                              )}
                              <LancamentoRowActions
                                tipo="receber"
                                parcelaId={p.id}
                                descricao={p.descricao ?? "Lançamento manual"}
                                lancamento={{
                                  id: p.id,
                                  descricao: p.descricao,
                                  categoria_id: p.categoria_id,
                                  valor: Number(p.valor ?? 0),
                                  forma_pagamento: p.forma_pagamento,
                                  data_emissao: p.data_emissao,
                                  data_vencimento: p.data_vencimento,
                                  cartao_id: p.cartao_id,
                                  caixa_id: p.caixa_id,
                                  observacoes: p.observacoes,
                                }}
                                categorias={categorias}
                                caixas={caixasList}
                                cartoes={cartoesList}
                              />
                            </>
                          ) : !p.is_manual && !ehPago && status !== "cancelado" ? (
                            <>
                              <ProrrogarParcelaButton
                                parcelaId={p.id}
                                clienteNome={cli?.nome ?? p.descricao ?? ""}
                                descricao={p.descricao}
                                numero={p.numero}
                                totalParcelas={p.total_parcelas}
                                valor={Number(p.valor ?? 0)}
                                formaPagamento={p.forma_pagamento}
                                dataVencimento={p.data_vencimento}
                              />
                              {p.forma_pagamento !== "faturado" &&
                                p.forma_pagamento !== "pix" && (
                                  <MarcarParcelaPagaButton
                                    parcelaId={p.id}
                                    dataVencimento={p.data_vencimento}
                                    valor={Number(p.valor ?? 0)}
                                    caixas={caixasList}
                                  />
                                )}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    )}
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
