import type { Metadata } from "next"
import { ShoppingCart, ShieldCheck, Users } from "lucide-react"
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
  pendente_validacao: "Aguardando aprovação",
  aprovado: "Aprovada",
  cancelado: "Cancelada",
  devolvido: "Devolvida",
}

const STATUS_CHIP: Record<string, string> = {
  rascunho: "border-white/15 bg-white/[0.04] text-white/55",
  pendente_validacao: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  aprovado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelado: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  devolvido: "border-violet-500/30 bg-violet-500/10 text-violet-300",
}

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
    .limit(100)

  const podeAprovar = can(user, "vendas", "aprovar")
  const podeEditarGlobal = can(user, "vendas", "editar")
  const mostraComissao = podeAprovar

  const linhas = (vendas ?? []).map((v) => ({
    ...v,
    total: (v.produtos as { valor_venda: number }[] | null)?.reduce(
      (a, p) => a + Number(p.valor_venda ?? 0),
      0,
    ) ?? 0,
  }))

  // KPIs
  const pendentes = linhas.filter((v) => v.status === "pendente_validacao")
  const aprovadas = linhas.filter((v) => v.status === "aprovado")
  const totalMes = linhas
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
            Relatório de Venda — fluxo de aprovação Agente → Gerente. Cada
            venda criada fica aguardando validação antes de virar financeiro.
          </p>
        </div>

        {can(user, "vendas", "criar") && <NovaVendaButton />}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Aguardando aprovação"
          value={pendentes.length}
          icon={<ShieldCheck className="h-4 w-4 text-amber-300" />}
          accent="amber"
        />
        <Kpi
          label="Aprovadas (últimas 100)"
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

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">ID</TableHead>
              <TableHead className="text-white/55">Data</TableHead>
              <TableHead className="text-white/55">Cliente</TableHead>
              <TableHead className="text-white/55">Empresa</TableHead>
              <TableHead className="text-white/55">Agente</TableHead>
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
                  className="h-24 text-center text-sm text-white/45"
                >
                  Nenhuma venda registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((v) => {
                const podeEditarEsta =
                  podeEditarGlobal || v.usuario_id === user.id
                const clienteNome =
                  (v.cliente as { nome: string } | null)?.nome ?? "—"

                return (
                  <TableRow
                    key={v.id}
                    className="border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell className="font-mono text-xs font-medium text-nexus-bright">
                      {v.identificador}
                    </TableCell>
                    <TableCell className="text-sm text-white/85">
                      {formatDateBR(v.data_venda)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-white">
                      {clienteNome}
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {(v.empresa as { nome: string } | null)?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {(v.agente as { nome: string } | null)?.nome ?? "—"}
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
                          clienteNome,
                          totalVenda: formatBRL(v.total),
                        }}
                        podeAprovar={podeAprovar}
                        podeEditar={podeEditarEsta}
                        mostraComissao={mostraComissao}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
