import type { Metadata } from "next"
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react"
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
import {
  FluxoCaixaChart,
  type FluxoPonto,
} from "@/components/financeiro/fluxo-caixa-chart"

export const metadata: Metadata = { title: "Fluxo de Caixa" }

type SearchParams = Promise<{ inicio?: string; fim?: string }>

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoSomaDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d + dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
}

function rangePadrao(hoje: string): { inicio: string; fim: string } {
  return { inicio: isoSomaDias(hoje, -30), fim: isoSomaDias(hoje, 60) }
}

function primeiroDiaMes(hoje: string): string {
  return hoje.slice(0, 7) + "-01"
}

type MovimentoRow = {
  data: string
  valor: number
  origem: "receber" | "pagar"
  status: string
  isManual: boolean
  isCartaoAgencia: boolean
  descricao: string
  categoria: string | null
  ref: string
}

export default async function FluxoDeCaixaPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver o fluxo de caixa.
      </div>
    )
  }

  const sp = await searchParams
  const hoje = hojeIso()
  const padrao = rangePadrao(hoje)
  const inicio = sp.inicio || padrao.inicio
  const fim = sp.fim || padrao.fim

  // Links para presets de período (calculados no servidor)
  const presetEsteMes = `?inicio=${primeiroDiaMes(hoje)}&fim=${hoje}`
  const presetUltimos30 = `?inicio=${isoSomaDias(hoje, -30)}&fim=${hoje}`
  const presetProximos30 = `?inicio=${hoje}&fim=${isoSomaDias(hoje, 30)}`

  // Preset ativo: compara com o range atual
  const ativoEsteMes = inicio === primeiroDiaMes(hoje) && fim === hoje
  const ativoUltimos30 = inicio === isoSomaDias(hoje, -30) && fim === hoje
  const ativoProximos30 = inicio === hoje && fim === isoSomaDias(hoje, 30)

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const [recRes, pagRes] = await Promise.all([
    sb
      .from("parcelas_receber")
      .select(
        `valor, data_vencimento, data_pagamento, status, descricao,
         is_manual, forma_pagamento,
         categoria:categorias_financeiras(nome),
         venda:vendas(identificador), cliente:clientes(nome)`,
      )
      .gte("data_vencimento", inicio)
      .lte("data_vencimento", fim),
    sb
      .from("parcelas_pagar")
      .select(
        `valor, data_vencimento, data_pagamento, status, descricao,
         is_manual, forma_pagamento, fornecedor_nome,
         categoria:categorias_financeiras(nome),
         venda_produto:venda_produtos(venda:vendas(identificador))`,
      )
      .gte("data_vencimento", inicio)
      .lte("data_vencimento", fim),
  ])

  type RecRow = {
    valor: number | string
    data_vencimento: string
    data_pagamento: string | null
    status: string
    descricao: string | null
    is_manual: boolean
    forma_pagamento: string | null
    categoria: { nome: string } | { nome: string }[] | null
    venda: { identificador: string } | { identificador: string }[] | null
    cliente: { nome: string } | { nome: string }[] | null
  }
  type PagRow = {
    valor: number | string
    data_vencimento: string
    data_pagamento: string | null
    status: string
    descricao: string | null
    is_manual: boolean
    forma_pagamento: string | null
    fornecedor_nome: string | null
    categoria: { nome: string } | { nome: string }[] | null
    venda_produto:
      | { venda: { identificador: string } | { identificador: string }[] | null }
      | { venda: { identificador: string } | { identificador: string }[] | null }[]
      | null
  }

  const rec = (recRes.data ?? []) as RecRow[]
  const pag = (pagRes.data ?? []) as PagRow[]

  const movimentos: MovimentoRow[] = []

  for (const r of rec) {
    if (r.status === "cancelado") continue
    const c = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente
    const v = Array.isArray(r.venda) ? r.venda[0] : r.venda
    const cat = Array.isArray(r.categoria) ? r.categoria[0] : r.categoria
    movimentos.push({
      data: r.data_vencimento,
      valor: Number(r.valor ?? 0),
      origem: "receber",
      status: r.status,
      isManual: !!r.is_manual,
      isCartaoAgencia: r.forma_pagamento === "cartao_agencia",
      descricao: r.is_manual ? (cat?.nome ?? "Lançamento manual") : (r.descricao ?? "Recebimento"),
      categoria: r.is_manual ? (r.descricao ?? null) : null,
      ref: r.is_manual ? "" : [v?.identificador, c?.nome].filter(Boolean).join(" · "),
    })
  }

  for (const r of pag) {
    if (r.status === "cancelado") continue
    const vp = Array.isArray(r.venda_produto) ? r.venda_produto[0] : r.venda_produto
    const v = vp ? (Array.isArray(vp.venda) ? vp.venda[0] : vp.venda) : null
    const cat = Array.isArray(r.categoria) ? r.categoria[0] : r.categoria
    movimentos.push({
      data: r.data_vencimento,
      valor: Number(r.valor ?? 0),
      origem: "pagar",
      status: r.status,
      isManual: !!r.is_manual,
      isCartaoAgencia: r.forma_pagamento === "cartao_agencia",
      descricao: r.is_manual ? (cat?.nome ?? "Lançamento manual") : (r.fornecedor_nome ?? r.descricao ?? "Pagamento"),
      categoria: r.is_manual ? (r.descricao ?? null) : null,
      ref: r.is_manual ? "" : [v?.identificador, r.fornecedor_nome].filter(Boolean).join(" · "),
    })
  }

  // KPIs
  const totalEntradas = movimentos.filter((m) => m.origem === "receber").reduce((a, m) => a + m.valor, 0)
  const totalRecebido = movimentos.filter((m) => m.origem === "receber" && m.status === "pago").reduce((a, m) => a + m.valor, 0)
  const totalSaidas = movimentos.filter((m) => m.origem === "pagar").reduce((a, m) => a + m.valor, 0)
  const saldoPrevisto = totalEntradas - totalSaidas

  // Gráfico
  const porDia = new Map<string, { entradas: number; saidas: number }>()
  for (const m of movimentos) {
    const cur = porDia.get(m.data) ?? { entradas: 0, saidas: 0 }
    if (m.origem === "receber") cur.entradas += m.valor
    else cur.saidas += m.valor
    porDia.set(m.data, cur)
  }
  const pontos: FluxoPonto[] = []
  let saldo = 0
  let cursor = inicio
  while (cursor <= fim) {
    const dia = porDia.get(cursor) ?? { entradas: 0, saidas: 0 }
    saldo += dia.entradas - dia.saidas
    pontos.push({
      data: cursor,
      entradas: dia.entradas,
      saidas: dia.saidas,
      saldoAcumulado: Number(saldo.toFixed(2)),
    })
    cursor = isoSomaDias(cursor, 1)
  }

  movimentos.sort((a, b) => a.data.localeCompare(b.data))

  const presetCls = (ativo: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      ativo
        ? "border-nexus-bright/60 bg-nexus-bright/15 text-nexus-bright"
        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
    }`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <Wallet className="h-6 w-6 text-nexus-bright" />
            Fluxo de Caixa
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Entradas e saídas do período — pendentes e realizadas.
          </p>
        </div>

        {/* Filtros de período */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Presets rápidos */}
          <div className="flex items-center gap-1.5">
            <a href={presetEsteMes} className={presetCls(ativoEsteMes)}>
              Este mês
            </a>
            <a href={presetUltimos30} className={presetCls(ativoUltimos30)}>
              Últimos 30 dias
            </a>
            <a href={presetProximos30} className={presetCls(ativoProximos30)}>
              Próximos 30 dias
            </a>
          </div>

          {/* Intervalo personalizado */}
          <form className="flex flex-wrap items-end gap-2" action="" method="get">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">De</label>
              <input
                type="date"
                name="inicio"
                defaultValue={inicio}
                className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-sm tabular-nums text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Até</label>
              <input
                type="date"
                name="fim"
                defaultValue={fim}
                className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-sm tabular-nums text-white"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-md border border-nexus-bright/40 bg-nexus-bright/15 px-3 text-xs font-medium text-nexus-bright transition-colors hover:bg-nexus-bright/25"
            >
              Aplicar
            </button>
          </form>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Entradas previstas"
          value={formatBRL(totalEntradas)}
          tone="success"
          hint={`${formatDateBr(inicio)} a ${formatDateBr(fim)}`}
        />
        <KpiCard
          label="Já recebido"
          value={formatBRL(totalRecebido)}
          tone="neutral"
          hint="Confirmado no período"
        />
        <KpiCard
          label="Saídas previstas"
          value={formatBRL(totalSaidas)}
          tone="danger"
          hint={`${formatDateBr(inicio)} a ${formatDateBr(fim)}`}
        />
        <KpiCard
          label="Saldo previsto"
          value={formatBRL(saldoPrevisto)}
          tone={saldoPrevisto >= 0 ? "info" : "warning"}
          hint="Entradas − saídas"
        />
      </div>

      {/* Chart */}
      <FluxoCaixaChart pontos={pontos} hoje={hoje} />

      {/* Tabela combinada */}
      {movimentos.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-white/55">Nenhum movimento no período selecionado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                <TableHead className="w-[110px]">Data</TableHead>
                <TableHead className="w-[75px]">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[95px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.map((m, i) => {
                const ehRec = m.origem === "receber"
                const ehAtrasado = m.status === "pendente" && m.data < hoje && !m.isCartaoAgencia
                const ehPago = m.status === "pago"

                return (
                  <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.025]">
                    <TableCell className="tabular-nums text-sm">
                      <span className={ehAtrasado ? "font-medium text-rose-300" : ""}>
                        {formatDateBr(m.data)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          ehRec
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {ehRec ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {ehRec ? "Entrada" : "Saída"}
                      </span>
                    </TableCell>

                    <TableCell className="text-sm text-white/85">
                      {m.isManual && m.categoria ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{m.descricao}</span>
                          <span className="text-[10px] text-white/35">{m.categoria}</span>
                        </div>
                      ) : (
                        m.descricao
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-white/55">
                      {m.ref || <span className="text-white/25">—</span>}
                    </TableCell>

                    <TableCell
                      className={`text-right tabular-nums text-sm font-medium ${
                        ehRec ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {ehRec ? "+" : "−"} {formatBRL(m.valor)}
                    </TableCell>

                    <TableCell>
                      {m.isCartaoAgencia ? (
                        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/30">
                          Automático
                        </span>
                      ) : ehPago ? (
                        <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                          {ehRec ? "Recebido" : "Pago"}
                        </span>
                      ) : ehAtrasado ? (
                        <span className="rounded border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-300">
                          Atrasado
                        </span>
                      ) : (
                        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/45">
                          Pendente
                        </span>
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
