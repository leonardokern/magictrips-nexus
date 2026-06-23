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
import { MarcarPagoButton } from "@/components/financeiro/marcar-pago-button"

export const metadata: Metadata = { title: "Contas a Receber" }

type SearchParams = Promise<{
  status?: string
  mes?: string
  q?: string
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

/**
 * Status derivado: parcela `pendente` com vencimento no passado vira
 * "atrasado" na UI. O banco continua guardando `pendente` — a derivação
 * facilita filtrar/exibir sem precisar de cron de update.
 */
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

/** Primeira e última data do mês informado (YYYY-MM) em formato ISO date. */
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
  const podeEditar = can(user, "financeiro", "editar")

  const sp = await searchParams
  const statusFiltro = sp.status ?? ""
  const mesFiltro = sp.mes ?? ""
  const q = (sp.q ?? "").trim()
  const hoje = hojeIso()

  const supabase = await createClient()

  let queryBase = supabase
    .from("parcelas_receber")
    .select(
      `
      id, numero, total_parcelas, descricao, valor, forma_pagamento,
      data_vencimento, data_pagamento, status,
      cliente:clientes(id, nome),
      venda:vendas(id, identificador)
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

  // KPIs — agrega TODOS os registros do escopo do usuário (RLS aplicada).
  // Em escala, mover pra RPC com agregação SQL.
  type KpiRow = {
    valor: number | string
    data_vencimento: string
    data_pagamento: string | null
    status: string
  }
  const { data: kpiRows } = await supabase
    .from("parcelas_receber")
    .select("valor, data_vencimento, data_pagamento, status")

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
      if (r.status === "pago" && r.data_pagamento?.startsWith(mes)) {
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
    status: string
    cliente: { id: string; nome: string } | { id: string; nome: string }[] | null
    venda:
      | { id: string; identificador: string }
      | { id: string; identificador: string }[]
      | null
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

      {/* Filtros */}
      <FinanceFilters
        placeholderBusca="Buscar por cliente…"
        presets={[
          { label: "Atrasados", status: "atrasado" },
          { label: "Este mês", status: "", mes: mesAtualISO() },
          { label: "Pendentes", status: "pendente" },
          { label: "Recebidos", status: "pago" },
        ]}
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
                <TableHead>Cliente</TableHead>
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
                const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
                const vnd = Array.isArray(p.venda) ? p.venda[0] : p.venda
                const status = derivarStatus(p.status, p.data_vencimento, hoje)
                const ehPago = status === "pago"
                const ehAtrasado = status === "atrasado"
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
                      {cli?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-nexus-bright">
                      {vnd?.identificador ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-white/70">
                      {p.numero}/{p.total_parcelas}
                    </TableCell>
                    <TableCell className="text-xs text-white/70">
                      {p.forma_pagamento
                        ? FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento
                        : "—"}
                    </TableCell>
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
                            tipo="receber"
                            parcelaId={p.id}
                            acao={ehPago ? "pendente" : "pago"}
                            resumo={`Parcela ${p.numero}/${p.total_parcelas} de ${cli?.nome ?? "—"} · ${formatBRL(Number(p.valor ?? 0))}`}
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
