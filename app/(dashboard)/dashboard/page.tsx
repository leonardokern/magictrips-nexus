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
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
]

type Search = {
  periodo?: string
  from?: string
  to?: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Search
}) {
  const user = await requireCurrentUser()
  const podeVerDashboards = can(user, "dashboard", "ver")
  const podeCriarVenda = can(user, "vendas", "criar")

  // Default do filtro depende do papel:
  //   - Agente   → "Últimos 30 dias" (foco em performance recente)
  //   - Gestão   → "Mês atual" (foco no fechamento do mês)
  const defaultPeriodo: PeriodoValue =
    user.perfil.tipo === "agente" ? "ultimos-30d" : "mes-atual"
  const periodo = parsePeriodo(searchParams.periodo, defaultPeriodo)
  const range = computeRange(periodo, searchParams.from, searchParams.to)

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
      rav,
      rav_extra_cliente,
      rav_extra_fornecedor,
      tipo_produto_id,
      tipo_produto_nome,
      vendas:venda_id (
        id, status, data_aprovacao, empresa_id, usuario_id, origem,
        empresa:empresa_id ( nome, slug ),
        agente:usuarios!vendas_usuario_id_fkey ( nome )
      )
    `,
    )
    .eq("vendas.status", "aprovado")

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
    rav: number
    tipo_produto_id: string
    tipo_produto_nome: string
    venda_id: string
    data_aprovacao: string
    empresa_id: string
    empresa_nome: string
    empresa_slug: string
    usuario_id: string
    agente_nome: string
    origem: string
  }

  type VendaJoin = {
    id: string
    status: string
    data_aprovacao: string | null
    empresa_id: string
    usuario_id: string
    origem: string | null
    empresa: { nome: string; slug: string } | null
    agente: { nome: string } | null
  }

  const dados: LinhaProduto[] = []
  for (const l of linhas ?? []) {
    const v = l.vendas as unknown as VendaJoin | null
    if (!v || !v.data_aprovacao) continue
    // RAV total = rav base + extras (líquido pra empresa)
    const ravBase = Number(l.rav ?? 0)
    const ravExtraCli = Number(l.rav_extra_cliente ?? 0)
    const ravExtraFor = Number(l.rav_extra_fornecedor ?? 0)
    const ravTotal = ravBase + ravExtraCli + ravExtraFor
    dados.push({
      valor_venda: Number(l.valor_venda ?? 0),
      valor_custo: Number(l.valor_custo ?? 0),
      rav: ravTotal,
      tipo_produto_id: l.tipo_produto_id,
      tipo_produto_nome: l.tipo_produto_nome,
      venda_id: v.id,
      data_aprovacao: v.data_aprovacao,
      empresa_id: v.empresa_id,
      empresa_nome: v.empresa?.nome ?? "—",
      empresa_slug: v.empresa?.slug ?? "",
      usuario_id: v.usuario_id,
      agente_nome: v.agente?.nome ?? "—",
      origem: v.origem || "Sem origem",
    })
  }

  // ── KPIs principais ─────────────────────────────────────────────────────────
  const receita = sum(dados, (d) => d.valor_venda)
  const custo = sum(dados, (d) => d.valor_custo)
  const margem = receita - custo
  const margemPct = receita > 0 ? (margem / receita) * 100 : 0
  const ravTotal = sum(dados, (d) => d.rav)
  const ravPct = receita > 0 ? (ravTotal / receita) * 100 : 0
  const numVendas = new Set(dados.map((d) => d.venda_id)).size

  // ── Série mensal ────────────────────────────────────────────────────────────
  const serieMensal = buildSerieMensal(dados, range)

  // ── Empresa ────────────────────────────────────────────────────────────────
  // Receita por empresa (donut) + RAV por empresa (lista lateral)
  const porEmpresa = aggregate(
    dados,
    (d) => d.empresa_id,
    (d) => ({
      label: d.empresa_nome,
      slug: d.empresa_slug,
      receita: d.valor_venda,
      rav: d.rav,
      margem: d.valor_venda - d.valor_custo,
    }),
  ).sort((a, b) => b.receita - a.receita)
  const donutReceitaEmpresa = porEmpresa.map((e) => ({
    label: e.label,
    value: Math.max(0, Math.round(e.receita)),
    color: EMPRESA_COR[e.slug] ?? COR_FALLBACK,
  }))
  const donutReceitaTotal = donutReceitaEmpresa.reduce(
    (acc, d) => acc + d.value,
    0,
  )

  // ── Por agente (foco principal do cliente) ─────────────────────────────────
  const porAgente = aggregate(
    dados,
    (d) => d.usuario_id,
    (d) => ({
      label: d.agente_nome,
      receita: d.valor_venda,
      custo: d.valor_custo,
      rav: d.rav,
    }),
  ).map((a) => ({
    ...a,
    margem: a.receita - a.custo,
    margemRavPct: a.receita > 0 ? (a.rav / a.receita) * 100 : 0,
  }))

  // Contagem de vendas distintas por agente (key = nome do agente)
  const vendasPorAgente = new Map<string, Set<string>>()
  for (const d of dados) {
    const s = vendasPorAgente.get(d.agente_nome) ?? new Set<string>()
    s.add(d.venda_id)
    vendasPorAgente.set(d.agente_nome, s)
  }

  // Bar charts: Venda (receita) por agente + RAV por agente (TOP 10)
  const porAgenteOrdenado = porAgente.slice().sort((a, b) => b.receita - a.receita)
  const barVendaAgente = porAgenteOrdenado
    .slice(0, 10)
    .map((a) => ({ label: a.label, value: Math.max(0, Math.round(a.receita)) }))
  const barRavAgente = porAgente
    .slice()
    .sort((a, b) => b.rav - a.rav)
    .slice(0, 10)
    .map((a) => ({ label: a.label, value: Math.max(0, Math.round(a.rav)) }))

  // ── TOP 5 Tipo de Produto por Receita e por RAV ─────────────────────────────
  const porTipo = aggregate(
    dados,
    (d) => d.tipo_produto_id,
    (d) => ({
      label: d.tipo_produto_nome,
      receita: d.valor_venda,
      rav: d.rav,
    }),
  )
  const top5Receita = porTipo
    .slice()
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5)
    .map((t) => ({ label: t.label, value: Math.round(t.receita) }))

  // ── Origem do lead (donut esquerdo) ─────────────────────────────────────────
  // Paleta cíclica nas mesmas tonalidades do tema (Nexus + verde + âmbar).
  const PALETA_ORIGEM = [
    "#1498D5", // nexus-bright
    "#10B981", // emerald-500
    "#F59E0B", // amber-500
    "#A855F7", // purple-500
    "#EC4899", // pink-500
    "#0EA5E9", // sky-500
    "#84CC16", // lime-500
    "#F43F5E", // rose-500
  ]
  const porOrigem = aggregate(
    dados,
    (d) => d.origem,
    (d) => ({ label: d.origem, receita: d.valor_venda, rav: d.rav }),
  ).sort((a, b) => b.receita - a.receita)
  const donutReceitaOrigem = porOrigem.map((o, i) => ({
    label: o.label,
    value: Math.max(0, Math.round(o.receita)),
    color: PALETA_ORIGEM[i % PALETA_ORIGEM.length]!,
  }))
  const donutReceitaOrigemTotal = donutReceitaOrigem.reduce(
    (acc, d) => acc + d.value,
    0,
  )

  // ── Margem RAV por agente (% RAV sobre as PRÓPRIAS vendas do agente) ────────
  // Cada barra = quanto % das vendas daquele agente vira RAV (eficiência).
  // Diferente de "RAV por agente" em valor absoluto — aqui é razão individual.
  // Ordenado por % decrescente, filtra quem não tem receita no período.
  const barMargemRavAgente = porAgente
    .filter((a) => a.receita > 0)
    .map((a) => ({ label: a.label, value: a.margemRavPct }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // ── Tipos de produto mais vendidos por receita (tabela direita) ─────────────
  const porTipoOrdenado = porTipo
    .slice()
    .sort((a, b) => b.receita - a.receita)
  const receitaTipos = porTipoOrdenado.reduce(
    (acc, t) => acc + t.receita,
    0,
  )

  return (
    <div>

      {/* ════════════════════════════════════════════════════
          MOBILE — layout nativo de app
      ════════════════════════════════════════════════════ */}
      <div className="md:hidden">
        <div className="flex flex-col gap-3">

          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-nexus-deep/60 via-[#0d1a24] to-nexus-bright/10 p-5">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-nexus-bright/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-white">Início</p>
                  <p className="mt-0.5 text-xs text-white/45">{labelPeriodo(periodo, range)}</p>
                </div>
                <DashboardPeriodoFilter current={periodo} from={searchParams.from} to={searchParams.to} />
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Receita aprovada</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-white">{formatBRL(receita)}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-white/40">{numVendas} venda{numVendas !== 1 ? "s" : ""} aprovada{numVendas !== 1 ? "s" : ""}</span>
                  <span className="text-xs font-medium text-emerald-300">{margemPct.toFixed(1).replace(".", ",")}% margem</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats: Custo + Margem */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-rose-300/60">Custo</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">{formatBRL(custo)}</p>
              <p className="mt-1 text-[10px] text-white/35">dos fornecedores</p>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/60">Margem</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">{formatBRL(margem)}</p>
              <p className="mt-1 text-[10px] text-white/35">{margemPct.toFixed(1).replace(".", ",")}% da receita</p>
            </div>
          </div>

          {/* RAV */}
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/60">RAV Total</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-white">{formatBRL(ravTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Margem RAV</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-300">{ravPct.toFixed(1).replace(".", ",")}%</p>
            </div>
          </div>

          {/* CTA */}
          {podeCriarVenda && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-nexus-bright/20 bg-nexus-bright/[0.06] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Registrar venda</p>
              <NovaVendaButton className="w-full justify-center text-sm" />
            </div>
          )}

          {/* Por empresa */}
          {porEmpresa.length > 0 && (
            <div>
              <p className="mb-2.5 text-sm font-semibold text-white">Por empresa</p>
              <ul className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                {porEmpresa.map((e, i) => {
                  const pct = e.receita > 0 ? (e.rav / e.receita) * 100 : 0
                  return (
                    <li key={e.slug || e.label} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: EMPRESA_COR[e.slug] ?? COR_FALLBACK }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{e.label}</p>
                        <p className="text-[10px] text-white/40">{pct.toFixed(1).replace(".", ",")}% margem RAV</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-white/85">{formatBRL(e.receita)}</p>
                        <p className="text-[10px] tabular-nums text-emerald-300">{formatBRL(e.rav)} RAV</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Por agente */}
          {porAgenteOrdenado.length > 0 && (
            <div>
              <p className="mb-2.5 text-sm font-semibold text-white">Por agente</p>
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                {porAgenteOrdenado.map((a, i) => {
                  const qtdVendas = vendasPorAgente.get(a.label)?.size ?? 0
                  return (
                    <div key={`${a.label}-${a.receita}`} className={`px-4 py-3.5 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white">{a.label}</p>
                        <span className="text-xs text-white/40">{qtdVendas} venda{qtdVendas !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-white/35">Receita</p>
                          <p className="mt-0.5 text-xs tabular-nums text-white/80">{formatBRL(a.receita)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/35">RAV</p>
                          <p className="mt-0.5 text-xs tabular-nums font-medium text-emerald-300">{formatBRL(a.rav)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/35">Margem RAV</p>
                          <p className="mt-0.5 text-xs tabular-nums text-white/80">{a.margemRavPct.toFixed(1).replace(".", ",")}%</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="border-t border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Total</p>
                    <span className="text-xs font-semibold text-white">{numVendas} vendas</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-white/35">Receita</p>
                      <p className="mt-0.5 text-xs tabular-nums font-semibold text-white">{formatBRL(receita)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/35">RAV</p>
                      <p className="mt-0.5 text-xs tabular-nums font-semibold text-emerald-300">{formatBRL(ravTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/35">Margem RAV</p>
                      <p className="mt-0.5 text-xs tabular-nums font-semibold text-white">{ravPct.toFixed(1).replace(".", ",")}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top tipos de produto */}
          {top5Receita.length > 0 && (
            <div>
              <p className="mb-2.5 text-sm font-semibold text-white">Top tipos de produto</p>
              <ul className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                {top5Receita.map((t, i) => {
                  const maxVal = top5Receita[0]?.value ?? 1
                  return (
                    <li key={t.label} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="truncate text-xs font-medium text-white">{t.label}</p>
                          <p className="ml-2 shrink-0 text-xs tabular-nums text-white/65">{formatBRL(t.value)}</p>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-nexus-bright/60" style={{ width: `${(t.value / maxVal) * 100}%` }} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          DESKTOP — layout original inalterado
      ════════════════════════════════════════════════════ */}
      <div className="hidden md:block">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Início
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Receita, custo, margem e RAV das vendas aprovadas —{" "}
            {labelPeriodo(periodo, range)}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {podeCriarVenda && <NovaVendaButton />}
          <DashboardPeriodoFilter
            current={periodo}
            from={searchParams.from}
            to={searchParams.to}
          />
        </div>
      </div>

      {/* Linha 1 — KPIs financeiros principais (Receita / Custo / Margem) */}
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

      {/* Linha 2 — Foco do cliente: Venda por agente + RAV por agente */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Venda por agente"
          subtitulo={`Receita por vendedor · ${labelPeriodo(periodo, range)}`}
        >
          {barVendaAgente.length === 0 ? (
            <EmptyChart label="Nenhuma venda aprovada no período." />
          ) : (
            <HorizontalBarChartCard data={barVendaAgente} />
          )}
        </ChartCard>
        <ChartCard
          titulo="RAV por agente"
          subtitulo={`Remuneração da agência · ${labelPeriodo(periodo, range)}`}
        >
          {barRavAgente.length === 0 ? (
            <EmptyChart label="Sem RAV no período." />
          ) : (
            <HorizontalBarChartCard
              data={barRavAgente}
              primaryColor="#10b981"
            />
          )}
        </ChartCard>
      </div>

      {/* Linha 3 — Visão geral: Origem do lead + RAV por agente + Tipos de produto */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Receita por origem do lead
            </CardTitle>
            <p className="mt-0.5 text-xs text-white/45">
              {labelPeriodo(periodo, range)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-40">
              {donutReceitaOrigemTotal > 0 ? (
                <DonutChartCard
                  data={donutReceitaOrigem}
                  centerValue={formatBRL(donutReceitaOrigemTotal)}
                  centerLabel="receita"
                />
              ) : (
                <EmptyChart label="Sem receita no período." />
              )}
            </div>
            <div className="space-y-1.5">
              {donutReceitaOrigem.map((d) => (
                <div
                  key={d.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 truncate text-white/75">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="truncate">{d.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-white/55">
                    {formatBRL(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* NOVO: Margem RAV por agente — % do RAV sobre as vendas do próprio agente */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Margem RAV por agente
            </CardTitle>
            <p className="mt-0.5 text-xs text-white/45">
              % do RAV sobre as próprias vendas · {labelPeriodo(periodo, range)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {barMargemRavAgente.length === 0 ? (
                <EmptyChart label="Sem agentes com receita no período." />
              ) : (
                <HorizontalBarChartCard
                  data={barMargemRavAgente}
                  primaryColor="#10b981"
                  suffix="%"
                  decimals={1}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Tipos de produto mais vendidos
                </CardTitle>
                <p className="mt-0.5 text-xs text-white/45">
                  Receita + RAV + margem por tipo · {labelPeriodo(periodo, range)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold tabular-nums text-white">
                  {formatBRL(receitaTipos)}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
                  total
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-white/55">Tipo de produto</TableHead>
                    <TableHead className="text-right text-white/55">
                      Receita
                    </TableHead>
                    <TableHead className="text-right text-white/55">
                      RAV
                    </TableHead>
                    <TableHead className="text-right text-white/55">
                      Margem RAV
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porTipoOrdenado.length === 0 ? (
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-sm text-white/40"
                      >
                        Nenhuma venda aprovada no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    porTipoOrdenado.map((t) => {
                      const pct =
                        t.receita > 0 ? (t.rav / t.receita) * 100 : 0
                      return (
                        <TableRow
                          key={t.label}
                          className="border-white/[0.06] hover:bg-white/[0.025]"
                        >
                          <TableCell className="font-medium text-white">
                            {t.label || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-white/85">
                            {formatBRL(t.receita)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-300">
                            {formatBRL(t.rav)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-white">
                            {pct.toFixed(1).replace(".", ",")}%
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 4 — Receita por mês (área) */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Receita por mês
              </CardTitle>
              <p className="mt-0.5 text-xs text-white/45">
                {labelPeriodo(periodo, range)}
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

      {/* Linha 5 — Tabela completa por agente (Vendas, Receita, RAV, Margem) */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white">
            Detalhamento por agente
          </CardTitle>
          <p className="mt-0.5 text-xs text-white/45">
            Vendas, receita, RAV e margem por vendedor ·{" "}
            {labelPeriodo(periodo, range)}
          </p>
        </CardHeader>
        <CardContent>
          {/* Desktop: tabela completa */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-white/[0.06]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-white/55">Agente</TableHead>
                  <TableHead className="text-right text-white/55">
                    Vendas
                  </TableHead>
                  <TableHead className="text-right text-white/55">
                    Receita
                  </TableHead>
                  <TableHead className="text-right text-white/55">
                    Custo
                  </TableHead>
                  <TableHead className="text-right text-white/55">
                    Margem
                  </TableHead>
                  <TableHead className="text-right text-white/55">
                    RAV
                  </TableHead>
                  <TableHead className="text-right text-white/55">
                    Margem RAV
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porAgenteOrdenado.length === 0 ? (
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="h-20 text-center text-sm text-white/40"
                    >
                      Nenhuma venda aprovada no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {porAgenteOrdenado.map((a) => {
                      const qtdVendas = vendasPorAgente.get(a.label)?.size ?? 0
                      return (
                        <TableRow
                          key={`${a.label}-${a.receita}`}
                          className="border-white/[0.06] hover:bg-white/[0.025]"
                        >
                          <TableCell className="font-medium text-white">
                            {a.label}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-white/75">
                            {qtdVendas}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-white/85">
                            {formatBRL(a.receita)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-rose-300/85">
                            {formatBRL(a.custo)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-300/85">
                            {formatBRL(a.margem)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-emerald-300">
                            {formatBRL(a.rav)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-white/85">
                            {a.margemRavPct.toFixed(1).replace(".", ",")}%
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="border-t border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.03]">
                      <TableCell className="font-semibold uppercase tracking-wider text-[10px] text-white/55">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-white">
                        {numVendas}
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
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-300">
                        {formatBRL(ravTotal)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-white">
                        {ravPct.toFixed(1).replace(".", ",")}%
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: cards condensados */}
          <div className="flex flex-col gap-2 md:hidden">
            {porAgenteOrdenado.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">
                Nenhuma venda aprovada no período.
              </p>
            ) : (
              <>
                {porAgenteOrdenado.map((a) => {
                  const qtdVendas = vendasPorAgente.get(a.label)?.size ?? 0
                  return (
                    <div
                      key={`${a.label}-${a.receita}`}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.01] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white">{a.label}</p>
                        <span className="text-xs text-white/45">{qtdVendas} venda{qtdVendas !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-white/40">Receita</p>
                          <p className="tabular-nums text-white/85">{formatBRL(a.receita)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">RAV</p>
                          <p className="tabular-nums font-medium text-emerald-300">{formatBRL(a.rav)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">Margem RAV</p>
                          <p className="tabular-nums text-white/85">{a.margemRavPct.toFixed(1).replace(".", ",")}%</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Total</p>
                    <span className="text-xs font-semibold text-white">{numVendas} vendas</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-white/40">Receita</p>
                      <p className="tabular-nums font-semibold text-white">{formatBRL(receita)}</p>
                    </div>
                    <div>
                      <p className="text-white/40">RAV</p>
                      <p className="tabular-nums font-semibold text-emerald-300">{formatBRL(ravTotal)}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Margem RAV</p>
                      <p className="tabular-nums font-semibold text-white">{ravPct.toFixed(1).replace(".", ",")}%</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linha 6 — TOP 5 por Tipo de Produto: REMOVIDA.
          A tabela "Tipos de produto mais vendidos" da Linha 3 já cobre
          esses dados em formato mais informativo (com margem RAV %). */}
      </div>
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

function parsePeriodo(
  raw: string | undefined,
  fallback: PeriodoValue = "mes-atual",
): PeriodoValue {
  if (raw === "ultimos-30d") return "ultimos-30d"
  if (raw === "ultimos-3m") return "ultimos-3m"
  if (raw === "mes-passado") return "mes-passado"
  if (raw === "mes-atual") return "mes-atual"
  if (raw === "ano-atual") return "ano-atual"
  if (raw === "todos") return "todos"
  if (raw === "custom") return "custom"
  return fallback
}

function labelPeriodo(
  p: PeriodoValue,
  range: { from: Date; to: Date } | null,
): string {
  switch (p) {
    case "ultimos-30d":
      return "Últimos 30 dias"
    case "mes-atual":
      return capitalize(monthYearLabel(new Date()))
    case "mes-passado": {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return capitalize(monthYearLabel(d))
    }
    case "ultimos-3m":
      return "Últimos 3 meses"
    case "ano-atual":
      return `Ano de ${new Date().getFullYear()}`
    case "todos":
      return "Todos os tempos"
    case "custom":
      return range
        ? `${formatDateBR(range.from)} → ${formatDateBR(range.to)}`
        : "Período personalizado"
  }
}

function computeRange(
  p: PeriodoValue,
  fromIso?: string,
  toIso?: string,
): { from: Date; to: Date } | null {
  if (p === "todos") return null
  const hoje = new Date()

  if (p === "ultimos-30d") {
    const from = new Date(hoje)
    from.setDate(from.getDate() - 29) // inclui hoje → 30 dias no total
    from.setHours(0, 0, 0, 0)
    const to = new Date(hoje)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }

  if (p === "mes-atual") {
    return {
      from: new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0),
      to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
    }
  }

  if (p === "mes-passado") {
    return {
      from: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1, 0, 0, 0),
      to: new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59),
    }
  }

  if (p === "ultimos-3m") {
    const from = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1, 0, 0, 0)
    return {
      from,
      to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
    }
  }

  if (p === "ano-atual") {
    return {
      from: new Date(hoje.getFullYear(), 0, 1, 0, 0, 0),
      to: new Date(hoje.getFullYear(), 11, 31, 23, 59, 59),
    }
  }

  if (p === "custom" && fromIso && toIso) {
    const from = parseIsoDate(fromIso)
    const to = parseIsoDate(toIso)
    if (!from || !to || from > to) {
      // Range inválido → fallback pra mês atual
      return {
        from: new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0),
        to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
      }
    }
    return {
      from: new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0),
      to: new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59),
    }
  }

  return null
}

function parseIsoDate(iso: string): Date | null {
  // YYYY-MM-DD → Date local
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  return new Date(Number(y), Number(mo) - 1, Number(d))
}

function monthYearLabel(d: Date): string {
  return `${MESES_PT_CURTO[d.getMonth()]}/${d.getFullYear()}`
}

function formatDateBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getFullYear()}`
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
  let inicio: Date
  let fim: Date
  if (range) {
    inicio = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
    fim = new Date(range.to.getFullYear(), range.to.getMonth(), 1)
  } else {
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

