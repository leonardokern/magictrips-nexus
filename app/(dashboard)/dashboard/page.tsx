import type { Metadata } from "next"
import { ArrowDownRight, ArrowUpRight, Coins } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { createClient } from "@/lib/supabase/server"
import { formatBRL } from "@/lib/utils/sum-parser"
import { NovaVendaButton } from "@/components/vendas/nova-venda-button"
import { AreaChartCard } from "@/components/dashboard/charts/area-chart-card"
import { DonutChartCard } from "@/components/dashboard/charts/donut-chart-card"
import { HorizontalBarChartCard } from "@/components/dashboard/charts/horizontal-bar-chart-card"
import {
  DashboardPeriodoFilter,
  type PeriodoValue,
} from "@/components/dashboard/dashboard-periodo-filter"
import { AgenteDashboard } from "@/components/dashboard/agente-dashboard"

export const metadata: Metadata = { title: "Início" }

// Cores por empresa (alinhadas com Nexus)
const EMPRESA_COR: Record<string, string> = {
  "magic-trips": "#004E5A",
  "del-mondo": "#1498D5",
}
const COR_FALLBACK = "#46B1E0"

const MESES_PT_CURTO = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
]

type Search = { periodo?: string }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Search
}) {
  const user = await requireCurrentUser()
  const podeVerDashboards = can(user, "dashboard", "ver")
  const podeCriarVenda = can(user, "vendas", "criar")

  const periodo = parsePeriodo(searchParams.periodo)
  const range = computeRange(periodo)

  // Agente: dashboard próprio (vendas dele, comissões, top clientes dele)
  if (user.perfil.tipo === "agente") {
    return (
      <AgenteDashboard
        userId={user.id}
        userNome={user.nome}
        periodo={periodo}
        range={range}
        podeCriarVenda={podeCriarVenda}
      />
    )
  }

  // Sem permissão de dashboards de gestão: home minimalista
  if (!podeVerDashboards) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Início
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Use o menu lateral pra navegar. Os painéis de gestão são restritos a
            perfis de Administrador e Gerente.
          </p>
        </div>
        {podeCriarVenda && (
          <div className="rounded-xl border border-nexus-bright/30 bg-nexus-bright/[0.04] p-6">
            <p className="text-sm text-white/75">Atalho rápido:</p>
            <div className="mt-3">
              <NovaVendaButton />
            </div>
          </div>
        )}
      </div>
    )
  }

  const supabase = await createClient()

  // ── Query principal: produtos das vendas aprovadas no período ──────────────
  // Cada linha = 1 produto de 1 venda. Agregamos em memória (volume é pequeno
  // pra MVP; ao crescer migra-se pra uma view materializada ou função SQL).
  let q = supabase
    .from("venda_produtos")
    .select(
      `
      valor_venda,
      valor_custo,
      tipo_produto_id,
      tipo_produto_nome,
      vendas:venda_id (
        id, status, data_aprovacao, empresa_id, usuario_id,
        empresa:empresa_id ( nome, slug ),
        agente:usuarios!vendas_usuario_id_fkey ( nome )
      )
    `,
    )
    .eq("vendas.status", "aprovada")

  if (range) {
    q = q
      .gte("vendas.data_aprovacao", range.from.toISOString())
      .lte("vendas.data_aprovacao", range.to.toISOString())
  }

  const { data: linhas } = await q

  // Filtra null (joins frouxos) e normaliza
  type LinhaProduto = {
    valor_venda: number
    valor_custo: number
    tipo_produto_id: string
    tipo_produto_nome: string
    venda_id: string
    data_aprovacao: string
    empresa_id: string
    empresa_nome: string
    empresa_slug: string
    usuario_id: string
    agente_nome: string
  }

  type VendaJoin = {
    id: string
    status: string
    data_aprovacao: string | null
    empresa_id: string
    usuario_id: string
    empresa: { nome: string; slug: string } | null
    agente: { nome: string } | null
  }

  const dados: LinhaProduto[] = []
  for (const l of linhas ?? []) {
    const v = l.vendas as unknown as VendaJoin | null
    if (!v || !v.data_aprovacao) continue
    dados.push({
      valor_venda: Number(l.valor_venda ?? 0),
      valor_custo: Number(l.valor_custo ?? 0),
      tipo_produto_id: l.tipo_produto_id,
      tipo_produto_nome: l.tipo_produto_nome,
      venda_id: v.id,
      data_aprovacao: v.data_aprovacao,
      empresa_id: v.empresa_id,
      empresa_nome: v.empresa?.nome ?? "—",
      empresa_slug: v.empresa?.slug ?? "",
      usuario_id: v.usuario_id,
      agente_nome: v.agente?.nome ?? "—",
    })
  }

  // ── KPIs principais ─────────────────────────────────────────────────────────
  const receita = sum(dados, (d) => d.valor_venda)
  const custo = sum(dados, (d) => d.valor_custo)
  const margem = receita - custo
  const margemPct = receita > 0 ? (margem / receita) * 100 : 0
  const numVendas = new Set(dados.map((d) => d.venda_id)).size

  // ── Série mensal ────────────────────────────────────────────────────────────
  const serieMensal = buildSerieMensal(dados, range)

  // ── Margem por Empresa (donut) ──────────────────────────────────────────────
  const margemPorEmpresa = aggregate(
    dados,
    (d) => d.empresa_id,
    (d) => ({
      label: d.empresa_nome,
      slug: d.empresa_slug,
      value: d.valor_venda - d.valor_custo,
    }),
  ).sort((a, b) => b.value - a.value)
  const donutEmpresas = margemPorEmpresa.map((e) => ({
    label: e.label,
    value: Math.max(0, Math.round(e.value)),
    color: EMPRESA_COR[e.slug] ?? COR_FALLBACK,
  }))
  const donutTotal = donutEmpresas.reduce((acc, d) => acc + d.value, 0)

  // ── TOP 5 Tipo de Produto por Receita e por Margem ──────────────────────────
  const porTipo = aggregate(
    dados,
    (d) => d.tipo_produto_id,
    (d) => ({
      label: d.tipo_produto_nome,
      receita: d.valor_venda,
      margem: d.valor_venda - d.valor_custo,
    }),
  )
  const top5Receita = porTipo
    .slice()
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5)
    .map((t) => ({ label: t.label, value: Math.round(t.receita) }))
  const top5Margem = porTipo
    .slice()
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 5)
    .map((t) => ({ label: t.label, value: Math.round(t.margem) }))

  // ── Tabela: Agentes (flat) ──────────────────────────────────────────────────
  const porAgente = aggregate(
    dados,
    (d) => d.usuario_id,
    (d) => ({
      label: d.agente_nome,
      receita: d.valor_venda,
      custo: d.valor_custo,
    }),
  )
    .map((a) => ({
      ...a,
      margem: a.receita - a.custo,
    }))
    .sort((a, b) => b.receita - a.receita)

  // ── Margem por Agente (bar horizontal) ──────────────────────────────────────
  const barMargemAgente = porAgente
    .slice(0, 10)
    .map((a) => ({ label: a.label, value: Math.max(0, Math.round(a.margem)) }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Início
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Receita, custo e margem das vendas aprovadas — {range ? labelPeriodo(periodo) : "todos os tempos"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {podeCriarVenda && <NovaVendaButton />}
          <DashboardPeriodoFilter current={periodo} />
        </div>
      </div>

      {/* Linha 1 — KPIs financeiros */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          titulo="Receita"
          valor={formatBRL(receita)}
          icon={ArrowDownRight}
          tone="bright"
          hint={`${numVendas} venda(s) aprovada(s)`}
        />
        <KpiCard
          titulo="Custo"
          valor={formatBRL(custo)}
          icon={ArrowUpRight}
          tone="rose"
          hint="dos fornecedores"
        />
        <KpiCard
          titulo="Margem"
          valor={formatBRL(margem)}
          icon={Coins}
          tone="emerald"
          hint={`${margemPct.toFixed(1).replace(".", ",")}% da receita`}
        />
      </div>

      {/* Linha 2 — Receita por mês (2/3) + Margem por Empresa (1/3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Receita por mês
                </CardTitle>
                <p className="mt-0.5 text-xs text-white/45">
                  {labelPeriodo(periodo)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold tabular-nums text-white">
                  {formatBRL(receita)}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
                  total
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {serieMensal.length === 0 ? (
                <EmptyChart label="Sem vendas aprovadas no período." />
              ) : (
                <AreaChartCard data={serieMensal} tooltipSuffix="" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Margem por empresa
            </CardTitle>
            <p className="mt-0.5 text-xs text-white/45">{labelPeriodo(periodo)}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-40">
              {donutTotal > 0 ? (
                <DonutChartCard
                  data={donutEmpresas}
                  centerValue={formatBRL(donutTotal)}
                  centerLabel="margem"
                />
              ) : (
                <EmptyChart label="Sem margem positiva no período." />
              )}
            </div>
            <div className="space-y-1.5">
              {donutEmpresas.map((d) => (
                <div
                  key={d.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-white/75">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.label}
                  </span>
                  <span className="tabular-nums text-white/55">
                    {formatBRL(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 3 — TOP 5 Tipo de Produto (Receita) + TOP 5 (Margem) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="TOP 5 Tipo de Produto"
          subtitulo={`por receita · ${labelPeriodo(periodo)}`}
        >
          {top5Receita.length === 0 ? (
            <EmptyChart label="Nenhum produto no período." />
          ) : (
            <HorizontalBarChartCard data={top5Receita} />
          )}
        </ChartCard>
        <ChartCard
          titulo="TOP 5 Tipo de Produto"
          subtitulo={`por margem · ${labelPeriodo(periodo)}`}
        >
          {top5Margem.length === 0 ? (
            <EmptyChart label="Nenhum produto no período." />
          ) : (
            <HorizontalBarChartCard
              data={top5Margem}
              primaryColor="#10b981"
            />
          )}
        </ChartCard>
      </div>

      {/* Linha 4 — Tabela agentes + Margem por agente (bar) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Por agente
            </CardTitle>
            <p className="mt-0.5 text-xs text-white/45">
              Receita, custo e margem por vendedor · {labelPeriodo(periodo)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-white/55">Agente</TableHead>
                    <TableHead className="text-right text-white/55">
                      Receita
                    </TableHead>
                    <TableHead className="text-right text-white/55">
                      Custo
                    </TableHead>
                    <TableHead className="text-right text-white/55">
                      Margem
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porAgente.length === 0 ? (
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-sm text-white/40"
                      >
                        Nenhuma venda aprovada no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {porAgente.map((a) => (
                        <TableRow
                          key={`${a.label}-${a.receita}`}
                          className="border-white/[0.06] hover:bg-white/[0.025]"
                        >
                          <TableCell className="font-medium text-white">
                            {a.label}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-white/85">
                            {formatBRL(a.receita)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-rose-300/85">
                            {formatBRL(a.custo)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-emerald-300">
                            {formatBRL(a.margem)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.03]">
                        <TableCell className="font-semibold uppercase tracking-wider text-[10px] text-white/55">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-white">
                          {formatBRL(receita)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-rose-300">
                          {formatBRL(custo)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-300">
                          {formatBRL(margem)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <ChartCard
          titulo="Margem por agente"
          subtitulo={labelPeriodo(periodo)}
        >
          {barMargemAgente.length === 0 ? (
            <EmptyChart label="Sem agentes com venda no período." />
          ) : (
            <HorizontalBarChartCard
              data={barMargemAgente}
              primaryColor="#10b981"
            />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

type Tone = "emerald" | "rose" | "bright"
const TONE_BG: Record<Tone, string> = {
  bright: "bg-nexus-bright/15",
  rose: "bg-rose-500/15",
  emerald: "bg-emerald-500/15",
}
const TONE_TEXT: Record<Tone, string> = {
  bright: "text-nexus-bright",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
}
const TONE_RING: Record<Tone, string> = {
  bright: "ring-nexus-bright/25",
  rose: "ring-rose-500/25",
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

function ChartCard({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-white">
          {titulo}
        </CardTitle>
        <p className="mt-0.5 text-xs text-white/45">{subtitulo}</p>
      </CardHeader>
      <CardContent>
        <div className="h-56">{children}</div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-white/40">
      {label}
    </div>
  )
}

// ─── Helpers de período ──────────────────────────────────────────────────────

function parsePeriodo(raw?: string): PeriodoValue {
  if (raw === "ultimos-3m") return "ultimos-3m"
  if (raw === "ano-atual") return "ano-atual"
  if (raw === "todos") return "todos"
  return "mes-atual"
}

function labelPeriodo(p: PeriodoValue): string {
  switch (p) {
    case "mes-atual":
      return capitalize(monthYearLabel(new Date()))
    case "ultimos-3m":
      return "Últimos 3 meses"
    case "ano-atual":
      return `Ano de ${new Date().getFullYear()}`
    case "todos":
      return "Todos os tempos"
  }
}

function computeRange(p: PeriodoValue): { from: Date; to: Date } | null {
  if (p === "todos") return null
  const hoje = new Date()
  if (p === "mes-atual") {
    return {
      from: new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0),
      to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
    }
  }
  if (p === "ultimos-3m") {
    const from = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1, 0, 0, 0)
    return {
      from,
      to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
    }
  }
  // ano-atual
  return {
    from: new Date(hoje.getFullYear(), 0, 1, 0, 0, 0),
    to: new Date(hoje.getFullYear(), 11, 31, 23, 59, 59),
  }
}

function monthYearLabel(d: Date): string {
  return `${MESES_PT_CURTO[d.getMonth()]}/${d.getFullYear()}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Helpers de agregação ────────────────────────────────────────────────────

function sum<T>(arr: T[], pick: (x: T) => number): number {
  return arr.reduce((acc, x) => acc + pick(x), 0)
}

function aggregate<T, R extends { label: string; [k: string]: unknown }>(
  arr: T[],
  keyFn: (x: T) => string,
  shape: (x: T) => R,
): R[] {
  const map = new Map<string, R>()
  for (const item of arr) {
    const k = keyFn(item)
    const shaped = shape(item)
    const existing = map.get(k)
    if (!existing) {
      map.set(k, { ...shaped })
      continue
    }
    // Soma todos os campos numéricos
    for (const [field, val] of Object.entries(shaped)) {
      if (typeof val === "number") {
        (existing as Record<string, unknown>)[field] =
          ((existing as Record<string, unknown>)[field] as number) + val
      }
    }
  }
  return Array.from(map.values())
}

function buildSerieMensal(
  dados: { data_aprovacao: string; valor_venda: number }[],
  range: { from: Date; to: Date } | null,
): { label: string; value: number }[] {
  // Determina os buckets de mês a renderizar
  let inicio: Date
  let fim: Date
  if (range) {
    inicio = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
    fim = new Date(range.to.getFullYear(), range.to.getMonth(), 1)
  } else {
    // "Todos": pega min/max das datas reais
    if (dados.length === 0) return []
    const dates = dados.map((d) => new Date(d.data_aprovacao))
    const min = new Date(Math.min(...dates.map((d) => d.getTime())))
    const max = new Date(Math.max(...dates.map((d) => d.getTime())))
    inicio = new Date(min.getFullYear(), min.getMonth(), 1)
    fim = new Date(max.getFullYear(), max.getMonth(), 1)
  }

  const buckets: { key: string; label: string; value: number }[] = []
  const cur = new Date(inicio)
  while (cur <= fim) {
    buckets.push({
      key: `${cur.getFullYear()}-${cur.getMonth()}`,
      label: `${MESES_PT_CURTO[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
      value: 0,
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  for (const d of dados) {
    const dt = new Date(d.data_aprovacao)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    const slot = buckets.find((b) => b.key === key)
    if (slot) slot.value += d.valor_venda
  }

  return buckets.map((b) => ({ label: b.label, value: Math.round(b.value) }))
}
