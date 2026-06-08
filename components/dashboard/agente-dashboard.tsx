import Link from "next/link"
import { CalendarDays, Coins, ShoppingCart, TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { formatBRL } from "@/lib/utils/sum-parser"
import { NovaVendaButton } from "@/components/vendas/nova-venda-button"
import {
  DashboardPeriodoFilter,
  type PeriodoValue,
} from "./dashboard-periodo-filter"
import { getStatusLabel, getStatusChip } from "@/lib/utils/venda-status"

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]


type Props = {
  userId: string
  userNome: string
  periodo: PeriodoValue
  range: { from: Date; to: Date } | null
  /** Permissão de criar vendas — esconde o card de atalho se false. */
  podeCriarVenda: boolean
}

export async function AgenteDashboard({
  userId,
  userNome,
  periodo,
  range,
  podeCriarVenda,
}: Props) {
  const supabase = await createClient()

  // ── Vendas do agente no período ─────────────────────────────────────────
  let vendasQuery = supabase
    .from("vendas")
    .select(
      "id, cliente_id, data_venda, data_aprovacao, status, comissao_percentual, cliente:cliente_id(nome)",
    )
    .eq("usuario_id", userId)
    .order("data_venda", { ascending: false })

  if (range) {
    vendasQuery = vendasQuery
      .gte("data_venda", range.from.toISOString())
      .lte("data_venda", range.to.toISOString())
  }

  const { data: vendasRaw } = await vendasQuery

  type VendaRow = {
    id: string
    cliente_id: string
    data_venda: string
    data_aprovacao: string | null
    status: string
    comissao_percentual: number | null
    cliente: { nome: string } | null
  }
  const vendas = (vendasRaw ?? []) as unknown as VendaRow[]
  const vendaIds = vendas.map((v) => v.id)

  // ── Produtos dessas vendas (pra calcular receita, custo, RAV) ──────────
  const { data: produtosRaw } =
    vendaIds.length === 0
      ? { data: [] }
      : await supabase
          .from("venda_produtos")
          .select(
            "venda_id, valor_venda, valor_custo, rav, rav_extra_cliente, rav_extra_fornecedor",
          )
          .in("venda_id", vendaIds)

  type ProdutoRow = {
    venda_id: string
    valor_venda: number
    valor_custo: number
    rav: number | null
    rav_extra_cliente: number | null
    rav_extra_fornecedor: number | null
  }
  const produtos = (produtosRaw ?? []) as ProdutoRow[]

  // Agrega por venda. RAV total = rav base + rav extra cliente + rav extra fornecedor.
  // Comissão do agente = RAV total × vendas.comissao_percentual (congelada na criação).
  const totaisPorVenda = new Map<
    string,
    { receita: number; custo: number; rav: number; comissao: number }
  >()
  for (const p of produtos) {
    const cur = totaisPorVenda.get(p.venda_id) ?? {
      receita: 0,
      custo: 0,
      rav: 0,
      comissao: 0,
    }
    cur.receita += Number(p.valor_venda ?? 0)
    cur.custo += Number(p.valor_custo ?? 0)
    cur.rav +=
      Number(p.rav ?? 0) +
      Number(p.rav_extra_cliente ?? 0) +
      Number(p.rav_extra_fornecedor ?? 0)
    totaisPorVenda.set(p.venda_id, cur)
  }
  // Aplica % de comissão (por venda) sobre o RAV agregado
  for (const v of vendas) {
    const t = totaisPorVenda.get(v.id)
    if (!t) continue
    const pct = Number(v.comissao_percentual ?? 0)
    t.comissao = (t.rav * pct) / 100
  }

  // ── KPIs (só vendas aprovadas entram em comissão "recebida") ─────────────
  const aprovadas = vendas.filter((v) => v.status === "aprovado")
  const totalComissao = aprovadas.reduce(
    (acc, v) => acc + (totaisPorVenda.get(v.id)?.comissao ?? 0),
    0,
  )
  const totalReceita = aprovadas.reduce(
    (acc, v) => acc + (totaisPorVenda.get(v.id)?.receita ?? 0),
    0,
  )
  const ticketMedio = aprovadas.length > 0 ? totalReceita / aprovadas.length : 0

  // ── Top 5 clientes do agente (por receita aprovada no período) ──────────
  const porCliente = new Map<
    string,
    { nome: string; vendas: number; receita: number }
  >()
  for (const v of aprovadas) {
    const cur = porCliente.get(v.cliente_id) ?? {
      nome: v.cliente?.nome ?? "—",
      vendas: 0,
      receita: 0,
    }
    cur.vendas += 1
    cur.receita += totaisPorVenda.get(v.id)?.receita ?? 0
    porCliente.set(v.cliente_id, cur)
  }
  const topClientes = Array.from(porCliente.values())
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5)

  // ── Últimas 10 vendas (qualquer status, dentro do período) ───────────────
  const ultimas = vendas.slice(0, 10)

  // ── Agenda: hoje + 3 dias seguintes ──────────────────────────────────────
  // Cobre lembretes do sistema (venda aprovada, devolvida, etc) + notas
  // pessoais criadas pelo agente. RPC filtra internamente por destinatário.
  // Pulamos a query toda quando a feature flag estiver desligada.
  const agendaFlag = await isFeatureEnabled("agenda")
  type AgendaRow = {
    id: string
    tipo: string
    titulo: string
    descricao: string
    dia: string
    cor: string
    hora_inicio: string | null
    hora_fim: string | null
  }
  const agendaPorDia = new Map<string, AgendaRow[]>()
  const proximosDias = Array.from({ length: 4 }, (_, i) => addDias(new Date(), i))
  if (agendaFlag) {
    const hojeISO = toISODate(new Date())
    const fimRangeISO = toISODate(addDias(new Date(), 3))
    const { data: agendaRows } = await supabase.rpc("get_agenda_eventos", {
      p_inicio: hojeISO,
      p_fim: fimRangeISO,
    })
    for (const ev of (agendaRows ?? []) as AgendaRow[]) {
      const arr = agendaPorDia.get(ev.dia) ?? []
      arr.push(ev)
      agendaPorDia.set(ev.dia, arr)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Olá, {userNome.split(" ")[0]} 👋
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Suas vendas e comissões — {labelPeriodo(periodo)}.
          </p>
        </div>
        <DashboardPeriodoFilter current={periodo} />
      </div>

      {/* Linha 1 — KPIs + atalho nova venda */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          titulo="Comissão"
          valor={formatBRL(totalComissao)}
          icon={Coins}
          tone="emerald"
          hint={`${aprovadas.length} venda(s) aprovada(s)`}
        />
        <KpiCard
          titulo="Vendas no período"
          valor={vendas.length.toString()}
          icon={ShoppingCart}
          tone="bright"
          hint={`${aprovadas.length} aprovada(s) · ${vendas.length - aprovadas.length} em outros status`}
        />
        <KpiCard
          titulo="Ticket médio"
          valor={formatBRL(ticketMedio)}
          icon={TrendingUp}
          tone="bright"
          hint="receita / nº de vendas aprovadas"
        />
        {podeCriarVenda && <AtalhoNovaVenda />}
      </div>

      {/* Linha 2 — Agenda dos próximos 4 dias (atrás de feature flag) */}
      {agendaFlag && (
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Próximos 4 dias
              </CardTitle>
              <p className="mt-0.5 text-xs text-white/45">
                Seus lembretes e notas pessoais
              </p>
            </div>
            <Link
              href="/agenda"
              className="text-xs text-nexus-bright hover:text-nexus-bright-soft"
            >
              Ver agenda completa →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proximosDias.map((dia, idx) => {
              const iso = toISODate(dia)
              const eventos = agendaPorDia.get(iso) ?? []
              const label =
                idx === 0
                  ? "Hoje"
                  : idx === 1
                    ? "Amanhã"
                    : DIAS_SEMANA_CURTO[dia.getDay()]
              return (
                <div
                  key={iso}
                  className="flex min-h-[140px] flex-col rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-white/75">
                      {label}
                    </span>
                    <span className="text-[10px] tabular-nums text-white/35">
                      {formatDiaCurto(dia)}
                    </span>
                  </div>
                  {eventos.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                      <span className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <CalendarDays className="h-3 w-3" />
                        Nenhum evento
                      </span>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {eventos.slice(0, 4).map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-start gap-1.5 rounded px-1.5 py-1"
                          style={{ backgroundColor: ev.cor + "1a" }}
                        >
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: ev.cor }}
                          />
                          <div
                            className="min-w-0 flex-1 text-[11px] leading-snug"
                            style={{ color: ev.cor }}
                          >
                            {ev.hora_inicio && (
                              <span className="mr-1 tabular-nums opacity-80">
                                {ev.hora_inicio}
                              </span>
                            )}
                            <span className="line-clamp-2 font-medium">
                              {ev.titulo}
                            </span>
                          </div>
                        </li>
                      ))}
                      {eventos.length > 4 && (
                        <li className="px-1.5 text-[10px] text-white/40">
                          +{eventos.length - 4} mais
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Linha 3 — últimas vendas + top clientes */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Últimas vendas
                </CardTitle>
                <p className="mt-0.5 text-xs text-white/45">
                  10 mais recentes no período
                </p>
              </div>
              <Link
                href="/vendas"
                className="text-xs text-nexus-bright hover:text-nexus-bright-soft"
              >
                Ver todas →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-white/55">Cliente</TableHead>
                  <TableHead className="text-white/55">Data</TableHead>
                  <TableHead className="text-right text-white/55">
                    Receita
                  </TableHead>
                  <TableHead className="text-right text-white/55">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimas.length === 0 ? (
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-sm text-white/40"
                    >
                      Nenhuma venda no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  ultimas.map((v) => {
                    const totais = totaisPorVenda.get(v.id) ?? {
                      receita: 0,
                      custo: 0,
                      comissao: 0,
                    }
                    return (
                      <TableRow
                        key={v.id}
                        className="border-white/[0.06] hover:bg-white/[0.025]"
                      >
                        <TableCell className="font-medium text-white">
                          {v.cliente?.nome ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-white/65">
                          {formatDataBR(v.data_venda)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-white/85">
                          {formatBRL(totais.receita)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getStatusChip(v.status)}`}
                          >
                            {/* Dashboard do agente — nunca tem podeAprovar */}
                            {getStatusLabel(v.status)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base font-semibold text-white">
                Principais clientes
              </CardTitle>
              <Users className="h-4 w-4 text-white/40" />
            </div>
            <p className="mt-0.5 text-xs text-white/45">
              Top 5 por receita aprovada
            </p>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/40">
                Sem clientes aprovados no período.
              </p>
            ) : (
              <ul className="space-y-2">
                {topClientes.map((c) => (
                  <li
                    key={c.nome}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {c.nome}
                      </p>
                      <p className="text-[11px] text-white/45">
                        {c.vendas} venda(s)
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-300">
                      {formatBRL(c.receita)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDias(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function formatDiaCurto(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0")
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  return `${dia}/${mes}`
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

type Tone = "emerald" | "bright"
const TONE_BG: Record<Tone, string> = {
  bright: "bg-nexus-bright/15",
  emerald: "bg-emerald-500/15",
}
const TONE_TEXT: Record<Tone, string> = {
  bright: "text-nexus-bright",
  emerald: "text-emerald-300",
}
const TONE_RING: Record<Tone, string> = {
  bright: "ring-nexus-bright/25",
  emerald: "ring-emerald-500/25",
}

function KpiCard({
  titulo,
  valor,
  icon: Icon,
  tone,
  hint,
}: {
  titulo: string
  valor: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
  hint?: string
}) {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
            {titulo}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {valor}
          </p>
          {hint && <p className="text-[11px] text-white/45">{hint}</p>}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONE_BG[tone]} ring-1 ${TONE_RING[tone]}`}
        >
          <Icon className={`h-5 w-5 ${TONE_TEXT[tone]}`} />
        </div>
      </CardContent>
    </Card>
  )
}

function AtalhoNovaVenda() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-nexus-bright/30 bg-nexus-bright/[0.06] py-5 text-center transition-colors hover:border-nexus-bright/60 hover:bg-nexus-bright/10">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
        Registrar venda
      </p>
      <NovaVendaButton />
    </Card>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function labelPeriodo(p: PeriodoValue): string {
  const hoje = new Date()
  switch (p) {
    case "mes-atual":
      return `${MESES_PT[hoje.getMonth()]} / ${hoje.getFullYear()}`
    case "mes-passado": {
      const d = new Date(hoje)
      d.setMonth(d.getMonth() - 1)
      return `${MESES_PT[d.getMonth()]} / ${d.getFullYear()}`
    }
    case "ultimos-3m":
      return "Últimos 3 meses"
    case "ano-atual":
      return `Ano de ${hoje.getFullYear()}`
    case "todos":
      return "Todos os tempos"
    case "custom":
      return "Período personalizado"
  }
}

function formatDataBR(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}
