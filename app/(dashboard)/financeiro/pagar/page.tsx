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

export const metadata: Metadata = { title: "Contas a Pagar" }

type SearchParams = Promise<{
  status?: string
  mes?: string
  q?: string
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
): ParcelaStatus {
  if (statusDb === "pago") return "pago"
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
  const mesFiltro = sp.mes ?? ""
  const q = (sp.q ?? "").trim()
  const hoje = hojeIso()

  const supabase = await createClient()

  let queryBase = supabase
    .from("parcelas_pagar")
    .select(
      `
      id, numero, total_parcelas, descricao, valor, forma_pagamento,
      data_vencimento, data_pagamento, status, fornecedor_nome,
      cartao:cartoes(id, nome),
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

  const { data: parcelasRaw, error } = await queryBase

  // KPIs
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
    cartao: { id: string; nome: string } | { id: string; nome: string }[] | null
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
        presets={[
          { label: "Atrasados", status: "atrasado" },
          { label: "Este mês", status: "", mes: mesAtualISO() },
          { label: "Pendentes", status: "pendente" },
          { label: "Pagos", status: "pago" },
        ]}
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
                const vp = Array.isArray(p.venda_produto)
                  ? p.venda_produto[0]
                  : p.venda_produto
                const vnd = vp
                  ? Array.isArray(vp.venda)
                    ? vp.venda[0]
                    : vp.venda
                  : null
                const status = derivarStatus(p.status, p.data_vencimento, hoje)
                const ehPago = status === "pago"
                const ehAtrasado = status === "atrasado"
                const formaBase = p.forma_pagamento
                  ? FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento
                  : "—"
                const forma = cartao?.nome ? `${formaBase} · ${cartao.nome}` : formaBase

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
                      {p.fornecedor_nome || "—"}
                    </TableCell>
                    <TableCell>
                      {vnd?.id && vnd?.identificador ? (
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
                      <ParcelaStatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      {podeEditar && status !== "cancelado" && (
                        <div className="flex justify-end">
                          <MarcarPagoButton
                            tipo="pagar"
                            parcelaId={p.id}
                            acao={ehPago ? "pendente" : "pago"}
                            resumo={`Parcela ${p.numero}/${p.total_parcelas} para ${p.fornecedor_nome ?? "—"} · ${formatBRL(Number(p.valor ?? 0))}`}
                          />
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
