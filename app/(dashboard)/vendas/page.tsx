import type { Metadata } from "next"
import { ShoppingCart, ShieldCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatBRL } from "@/lib/utils/sum-parser"
import { NovaVendaButton } from "@/components/vendas/nova-venda-button"
import { VendaRowActions } from "@/components/vendas/venda-row-actions"

export const metadata: Metadata = { title: "Vendas" }

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  pendente_validacao: "Aguardando aprovação",
  aprovado: "Aprovada",
  cancelado: "Cancelada",
}

const STATUS_CHIP: Record<string, string> = {
  rascunho: "border-white/15 bg-white/[0.04] text-white/55",
  em_revisao: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  pendente_validacao: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  aprovado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelado: "border-rose-500/30 bg-rose-500/10 text-rose-300",
}

const STATUS_PENDENTES = new Set(["pendente_validacao", "em_revisao"])

export default async function VendasPage() {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver vendas.
      </div>
    )
  }

  const supabase = await createClient()

  const { data: vendas } = await supabase
    .from("vendas")
    .select(
      `
      id, identificador, data_venda, status, pax, created_at, usuario_id,
      empresa:empresas(nome, slug),
      cliente:clientes(nome),
      agente:usuarios!vendas_usuario_id_fkey(nome),
      produtos:venda_produtos(valor_venda)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200)

  const podeAprovar = can(user, "vendas", "aprovar")
  // "Editar global" = capacidade de editar QUALQUER venda da empresa (Admin/Gerente).
  // Agentes também têm `vendas.editar`, mas só pra suas próprias vendas em
  // rascunho/em_revisao — esse caso é coberto pela regra de ownership no row.
  const podeEditarGlobal = can(user, "vendas", "aprovar")
  /** Permissão base `vendas.editar` — necessária pra edição em qualquer contexto. */
  const podeEditarBasico = can(user, "vendas", "editar")
  const podeExcluir = can(user, "vendas", "excluir")
  const mostraComissao = podeAprovar

  const linhas = (vendas ?? []).map((v) => ({
    ...v,
    total: (v.produtos as { valor_venda: number }[] | null)?.reduce(
      (a, p) => a + Number(p.valor_venda ?? 0),
      0,
    ) ?? 0,
  }))

  // ── Particiona em duas listas ─────────────────────────────────────────────
  const pendentes = linhas.filter((v) => STATUS_PENDENTES.has(v.status))
  const aprovadas = linhas.filter((v) => v.status === "aprovado")

  // KPIs
  const totalMes = aprovadas
    .filter((v) => {
      const d = new Date(v.data_venda)
      const hoje = new Date()
      return (
        d.getMonth() === hoje.getMonth() &&
        d.getFullYear() === hoje.getFullYear()
      )
    })
    .reduce((acc, v) => acc + v.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Vendas
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            {podeAprovar
              ? "Relatório de Venda — Admin/Gerente cadastram vendas já validadas. Agentes seguem fluxo de aprovação."
              : "Suas vendas — agentes cadastram para aprovação. Admin/Gerente da empresa valida em seguida."}
          </p>
        </div>

        {can(user, "vendas", "criar") && <NovaVendaButton />}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label={podeAprovar ? "Aguardando aprovação" : "Suas pendências"}
          value={pendentes.length}
          icon={<ShieldCheck className="h-4 w-4 text-amber-300" />}
          accent="amber"
        />
        <Kpi
          label="Aprovadas (últimas)"
          value={aprovadas.length}
          icon={<ShoppingCart className="h-4 w-4 text-emerald-300" />}
          accent="emerald"
        />
        <Kpi
          label="Total mês corrente"
          value={formatBRL(totalMes)}
          icon={<Users className="h-4 w-4 text-nexus-bright" />}
          accent="bright"
        />
      </div>

      {/* ── Seção 1: Aguardando validação ─────────────────────────────────── */}
      <VendasSection
        titulo="Aguardando validação"
        descricao={
          podeAprovar
            ? "Vendas submetidas por agentes que ainda precisam de aprovação."
            : "Suas vendas em fluxo de aprovação ou aguardando correção."
        }
        emptyMsg="Nenhuma venda aguardando validação."
        linhas={pendentes}
        userId={user.id}
        podeAprovar={podeAprovar}
        podeEditarGlobal={podeEditarGlobal}
        podeEditarBasico={podeEditarBasico}
        podeExcluir={podeExcluir}
        mostraComissao={mostraComissao}
      />

      {/* ── Seção 2: Validadas ────────────────────────────────────────────── */}
      <VendasSection
        titulo="Validadas"
        descricao={
          podeAprovar
            ? "Vendas aprovadas. Admin/Gerente podem excluir do sistema com auditoria."
            : "Suas vendas já aprovadas — visualização apenas."
        }
        emptyMsg="Nenhuma venda validada ainda."
        linhas={aprovadas}
        userId={user.id}
        podeAprovar={podeAprovar}
        podeEditarGlobal={podeEditarGlobal}
        podeEditarBasico={podeEditarBasico}
        podeExcluir={podeExcluir}
        mostraComissao={mostraComissao}
      />
    </div>
  )
}

// ─── Componente: seção (tabela + cards mobile) ───────────────────────────────

type Linha = {
  id: string
  identificador: string
  data_venda: string
  status: string
  pax: number
  usuario_id: string
  empresa: { nome: string; slug: string } | { nome: string; slug: string }[] | null
  cliente: { nome: string } | { nome: string }[] | null
  agente: { nome: string } | { nome: string }[] | null
  total: number
}

function VendasSection({
  titulo,
  descricao,
  emptyMsg,
  linhas,
  userId,
  podeAprovar,
  podeEditarGlobal,
  podeEditarBasico,
  podeExcluir,
  mostraComissao,
}: {
  titulo: string
  descricao: string
  emptyMsg: string
  linhas: Linha[]
  userId: string
  podeAprovar: boolean
  podeEditarGlobal: boolean
  podeEditarBasico: boolean
  podeExcluir: boolean
  mostraComissao: boolean
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">{titulo}</h3>
        <p className="mt-0.5 text-xs text-white/45">{descricao}</p>
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">ID</TableHead>
              <TableHead className="text-white/55">Data</TableHead>
              <TableHead className="text-white/55">Cliente</TableHead>
              <TableHead className="text-white/55">Empresa</TableHead>
              <TableHead className="text-white/55">Responsável</TableHead>
              <TableHead className="text-right text-white/55">PAX</TableHead>
              <TableHead className="text-right text-white/55">Valor</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className="h-20 text-center text-sm text-white/45"
                >
                  {emptyMsg}
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((v) => {
                const props = computeRowProps(v, {
                  userId,
                  podeAprovar,
                  podeEditarGlobal,
                  podeEditarBasico,
                  podeExcluir,
                  mostraComissao,
                })
                const emRevisao = v.status === "em_revisao"
                return (
                  <TableRow
                    key={v.id}
                    className={
                      emRevisao
                        ? "border-white/[0.06] border-l-2 border-l-orange-400/50 bg-orange-400/[0.04] hover:bg-orange-400/[0.07]"
                        : "border-white/[0.06] hover:bg-white/[0.025]"
                    }
                  >
                    <TableCell className="font-mono text-xs font-medium text-nexus-bright">
                      {v.identificador}
                    </TableCell>
                    <TableCell className="text-sm text-white/85">
                      {formatDateBR(v.data_venda)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-white">
                      {props.clienteNome}
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {props.empresaNome}
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {props.agenteNome}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-white/75">
                      {v.pax}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-white">
                      {formatBRL(v.total)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                          (STATUS_CHIP[v.status] ?? STATUS_CHIP.rascunho)
                        }
                      >
                        {STATUS_LABEL[v.status] ?? v.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <VendaRowActions
                        venda={{
                          id: v.id,
                          identificador: v.identificador,
                          status: v.status,
                          usuario_id: v.usuario_id,
                          clienteNome: props.clienteNome,
                          totalVenda: formatBRL(v.total),
                        }}
                        podeAprovar={podeAprovar}
                        podeEditar={props.podeEditarEsta}
                        podeExcluir={props.podeExcluirEsta}
                        mostraComissao={mostraComissao}
                        modoGerente={podeAprovar}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {linhas.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center text-sm text-white/45">
            {emptyMsg}
          </div>
        ) : (
          linhas.map((v) => {
            const props = computeRowProps(v, {
              userId,
              podeAprovar,
              podeEditarGlobal,
              podeEditarBasico,
              podeExcluir,
              mostraComissao,
            })
            const emRevisao = v.status === "em_revisao"
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-xl border bg-white/[0.02] p-4",
                  emRevisao
                    ? "border-l-2 border-orange-400/50 border-white/[0.06] bg-orange-400/[0.04]"
                    : "border-white/[0.06]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-nexus-bright">
                    {v.identificador}
                  </span>
                  <span
                    className={
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                      (STATUS_CHIP[v.status] ?? STATUS_CHIP.rascunho)
                    }
                  >
                    {STATUS_LABEL[v.status] ?? v.status}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{props.clienteNome}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                    {formatBRL(v.total)}
                  </p>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/50">
                  <span>{formatDateBR(v.data_venda)}</span>
                  <span>·</span>
                  <span>{props.empresaNome}</span>
                  <span>·</span>
                  <span>{v.pax} PAX</span>
                </div>
                {props.agenteNome !== "—" && (
                  <p className="mt-1 text-xs text-white/40">{props.agenteNome}</p>
                )}
                <div className="mt-3 flex justify-end border-t border-white/[0.04] pt-3">
                  <VendaRowActions
                    venda={{
                      id: v.id,
                      identificador: v.identificador,
                      status: v.status,
                      usuario_id: v.usuario_id,
                      clienteNome: props.clienteNome,
                      totalVenda: formatBRL(v.total),
                    }}
                    podeAprovar={podeAprovar}
                    podeEditar={props.podeEditarEsta}
                    podeExcluir={props.podeExcluirEsta}
                    mostraComissao={mostraComissao}
                    modoGerente={podeAprovar}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRowProps(
  v: Linha,
  ctx: {
    userId: string
    podeAprovar: boolean
    podeEditarGlobal: boolean
    /** Permissão genérica `vendas.editar` — exigida tanto pra edição global
     *  (Admin/Gerente) quanto pra edição das próprias vendas (Agente). */
    podeEditarBasico: boolean
    podeExcluir: boolean
    mostraComissao: boolean
  },
) {
  // Agente só edita as próprias em rascunho/em_revisao. Admin/Gerente edita
  // qualquer status (exceto aprovado, onde a UI de edição não faz sentido).
  // Em ambos os casos exige `vendas.editar`.
  const podeEditarEsta =
    ctx.podeEditarBasico &&
    ((ctx.podeEditarGlobal && v.status !== "aprovado") ||
      (v.usuario_id === ctx.userId &&
        (v.status === "rascunho" || v.status === "em_revisao")))

  // Excluir: somente quem tem permissão; só faz sentido em validada.
  const podeExcluirEsta = ctx.podeExcluir && v.status === "aprovado"

  const empresaObj = Array.isArray(v.empresa) ? v.empresa[0] : v.empresa
  const clienteObj = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente
  const agenteObj = Array.isArray(v.agente) ? v.agente[0] : v.agente

  return {
    podeEditarEsta,
    podeExcluirEsta,
    clienteNome: clienteObj?.nome ?? "—",
    empresaNome: empresaObj?.nome ?? "—",
    agenteNome: agenteObj?.nome ?? "—",
  }
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: "amber" | "emerald" | "bright"
}) {
  const accentColor =
    accent === "amber"
      ? "text-amber-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-nexus-bright"
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/45">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accentColor}`}>
        {value}
      </p>
    </div>
  )
}

function formatDateBR(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
