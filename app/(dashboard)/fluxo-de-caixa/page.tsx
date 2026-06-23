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

function rangePadrao(): { inicio: string; fim: string } {
  // Padrão: últimos 30 dias até 60 dias à frente — 90 dias de janela centrada
  // no presente. Dá visibilidade do que veio + do que vem.
  const hoje = hojeIso()
  return { inicio: isoSomaDias(hoje, -30), fim: isoSomaDias(hoje, 60) }
}

type MovimentoRow = {
  data: string
  valor: number
  origem: "receber" | "pagar"
  status: string
  descricao: string
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
  const padrao = rangePadrao()
  const inicio = sp.inicio || padrao.inicio
  const fim = sp.fim || padrao.fim
  const hoje = hojeIso()

  const supabase = await createClient()

  // Carrega receber + pagar no intervalo em paralelo.
  const [recRes, pagRes] = await Promise.all([
    supabase
      .from("parcelas_receber")
      .select(
        `valor, data_vencimento, data_pagamento, status, descricao,
         venda:vendas(identificador), cliente:clientes(nome)`,
      )
      .gte("data_vencimento", inicio)
      .lte("data_vencimento", fim),
    supabase
      .from("parcelas_pagar")
      .select(
        `valor, data_vencimento, data_pagamento, status, descricao,
         fornecedor_nome,
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
    venda: { identificador: string } | { identificador: string }[] | null
    cliente: { nome: string } | { nome: string }[] | null
  }
  type PagRow = {
    valor: number | string
    data_vencimento: string
    data_pagamento: string | null
    status: string
    descricao: string | null
    fornecedor_nome: string | null
    venda_produto:
      | { venda: { identificador: string } | { identificador: string }[] | null }
      | {
          venda:
            | { identificador: string }
            | { identificador: string }[]
            | null
        }[]
      | null
  }

  const rec = (recRes.data ?? []) as RecRow[]
  const pag = (pagRes.data ?? []) as PagRow[]

  // Lista de movimentos pra renderizar tabela + agregar no chart.
  const movimentos: MovimentoRow[] = []

  for (const r of rec) {
    if (r.status === "cancelado") continue
    const c = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente
    const v = Array.isArray(r.venda) ? r.venda[0] : r.venda
    movimentos.push({
      data: r.data_vencimento,
      valor: Number(r.valor ?? 0),
      origem: "receber",
      status: r.status,
      descricao: r.descricao ?? "Recebimento",
      ref: `${v?.identificador ?? "—"} · ${c?.nome ?? "—"}`,
    })
  }
  for (const r of pag) {
    if (r.status === "cancelado") continue
    const vp = Array.isArray(r.venda_produto) ? r.venda_produto[0] : r.venda_produto
    const v = vp ? (Array.isArray(vp.venda) ? vp.venda[0] : vp.venda) : null
    movimentos.push({
      data: r.data_vencimento,
      valor: Number(r.valor ?? 0),
      origem: "pagar",
      status: r.status,
      descricao: r.descricao ?? "Pagamento",
      ref: `${v?.identificador ?? "—"} · ${r.fornecedor_nome ?? "—"}`,
    })
  }

  // KPIs: somatório no período (entradas previstas, saídas previstas,
  // saldo previsto = entradas - saídas).
  const totalEntradas = movimentos
    .filter((m) => m.origem === "receber")
    .reduce((acc, m) => acc + m.valor, 0)
  const totalSaidas = movimentos
    .filter((m) => m.origem === "pagar")
    .reduce((acc, m) => acc + m.valor, 0)
  const saldoPrevisto = totalEntradas - totalSaidas

  // Agrega por dia pro chart. Constrói uma timeline contínua do `inicio`
  // até `fim` pra que o eixo X não tenha buracos.
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

  // Ordena movimentos por data
  movimentos.sort((a, b) => a.data.localeCompare(b.data))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <Wallet className="h-6 w-6 text-nexus-bright" />
            Fluxo de Caixa
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Entradas e saídas previstas do período — independente de
            pagamento já efetuado.
          </p>
        </div>

        {/* Range — server-side via querystring */}
        <form className="flex flex-wrap items-end gap-2" action="" method="get">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
              De
            </label>
            <input
              type="date"
              name="inicio"
              defaultValue={inicio}
              className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-sm tabular-nums text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">
              Até
            </label>
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

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Entradas previstas"
          value={formatBRL(totalEntradas)}
          tone="success"
          hint={`${formatDateBr(inicio)} a ${formatDateBr(fim)}`}
        />
        <KpiCard
          label="Saídas previstas"
          value={formatBRL(totalSaidas)}
          tone="danger"
          hint={`${formatDateBr(inicio)} a ${formatDateBr(fim)}`}
        />
        <KpiCard
          label="Saldo do período"
          value={formatBRL(saldoPrevisto)}
          tone={saldoPrevisto >= 0 ? "info" : "warning"}
          hint="Entradas − saídas"
        />
      </div>

      {/* Chart */}
      <FluxoCaixaChart pontos={pontos} />

      {/* Tabela combinada */}
      {movimentos.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-white/55">
            Nenhum movimento no período selecionado.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                <TableHead className="w-[110px]">Data</TableHead>
                <TableHead className="w-[70px]">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.map((m, i) => {
                const ehRec = m.origem === "receber"
                const ehAtrasado = m.status === "pendente" && m.data < hoje
                return (
                  <TableRow
                    key={i}
                    className="border-white/[0.04] hover:bg-white/[0.025]"
                  >
                    <TableCell className="tabular-nums text-sm">
                      <span
                        className={ehAtrasado ? "font-medium text-rose-300" : ""}
                      >
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
                        {ehRec ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {ehRec ? "Entrada" : "Saída"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-white/85">
                      {m.descricao}
                    </TableCell>
                    <TableCell className="text-xs text-white/55">
                      {m.ref}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums text-sm font-medium ${
                        ehRec ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {ehRec ? "+" : "−"} {formatBRL(m.valor)}
                    </TableCell>
                    <TableCell className="text-xs text-white/55">
                      {m.status === "pago"
                        ? ehRec
                          ? "Recebido"
                          : "Pago"
                        : ehAtrasado
                          ? "Atrasado"
                          : "Pendente"}
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
