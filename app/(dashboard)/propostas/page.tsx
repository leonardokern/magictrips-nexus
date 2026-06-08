import type { Metadata } from "next"
import { notFound } from "next/navigation"
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
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { NovaPropostaButton } from "@/components/propostas/nova-proposta-button"
import { PropostaRowActions } from "@/components/propostas/proposta-row-actions"
import type { PropostaStatus } from "./actions"

export const metadata: Metadata = { title: "Propostas" }

const SELECT_LISTA = `
  id, identificador, status, data_proposta, validade, destino, valor_total,
  cliente_nome,
  empresa:empresas(nome, slug),
  agente:usuarios!propostas_usuario_id_fkey(nome),
  cliente:clientes(nome)
` as const

const STATUS_CHIP: Record<PropostaStatus, string> = {
  rascunho: "border-white/20 bg-white/[0.06] text-white/60",
  enviada: "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright",
  aceita: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  recusada: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  expirada: "border-amber-500/30 bg-amber-500/10 text-amber-300",
}

const STATUS_LABEL: Record<PropostaStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
}

type PropostaRow = {
  id: string
  identificador: string
  status: PropostaStatus
  dataProposta: string
  validade: string | null
  destino: string | null
  valorTotal: number
  clienteNome: string
  empresaNome: string
  agenteNome: string
}

function formatDateBR(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  })
}

export default async function PropostasPage() {
  const [user, propostasFlag] = await Promise.all([
    requireCurrentUser(),
    isFeatureEnabled("propostas"),
  ])

  if (!propostasFlag) notFound()

  if (!can(user, "propostas", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver propostas.
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any
  const podeEditar = can(user, "propostas", "editar")
  const podeExcluir = can(user, "propostas", "excluir")

  const { data: propostas } = await supabase
    .from("propostas")
    .select(SELECT_LISTA)
    .order("created_at", { ascending: false })
    .limit(200)

  const rows: PropostaRow[] = (propostas ?? []).map((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const empresa = Array.isArray(p.empresa) ? p.empresa[0] : p.empresa
    const agente = Array.isArray(p.agente) ? p.agente[0] : p.agente
    const cliente = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
    return {
      id: p.id as string,
      identificador: p.identificador as string,
      status: p.status as PropostaStatus,
      dataProposta: (p.data_proposta ?? "") as string,
      validade: (p.validade ?? null) as string | null,
      destino: (p.destino ?? null) as string | null,
      valorTotal: Number(p.valor_total ?? 0),
      clienteNome: (cliente?.nome ?? p.cliente_nome ?? "—") as string,
      empresaNome: (empresa?.nome ?? "—") as string,
      agenteNome: (agente?.nome ?? "—") as string,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Propostas</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Propostas comerciais com PDF executivo para apresentar a clientes e prospects.
          </p>
        </div>
        {can(user, "propostas", "criar") && <NovaPropostaButton />}
      </div>

      {/* Tabela desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">ID</TableHead>
              <TableHead className="text-white/55">Data</TableHead>
              <TableHead className="text-white/55">Cliente</TableHead>
              <TableHead className="text-white/55">Destino</TableHead>
              <TableHead className="text-white/55">Responsável</TableHead>
              <TableHead className="text-right text-white/55">Total</TableHead>
              <TableHead className="text-white/55">Validade</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell colSpan={9} className="h-24 text-center text-sm text-white/45">
                  Nenhuma proposta ainda. Crie a primeira clicando em &ldquo;Nova proposta&rdquo;.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id} className="border-white/[0.06] hover:bg-white/[0.025]">
                  <TableCell className="font-mono text-xs font-medium text-nexus-bright">
                    {p.identificador}
                  </TableCell>
                  <TableCell className="text-sm text-white/85">
                    {formatDateBR(p.dataProposta)}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-white">
                    {p.clienteNome}
                  </TableCell>
                  <TableCell className="text-sm text-white/65">
                    {p.destino ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-white/65">
                    {p.agenteNome}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-white">
                    {formatBRL(p.valorTotal)}
                  </TableCell>
                  <TableCell className="text-sm text-white/65">
                    {p.validade ? formatDateBR(p.validade) : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                        STATUS_CHIP[p.status]
                      }
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PropostaRowActions
                      proposta={{
                        id: p.id,
                        identificador: p.identificador,
                        status: p.status,
                        clienteNome: p.clienteNome,
                        podeEditar,
                        podeExcluir,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cards mobile */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-white/45">
            Nenhuma proposta ainda.
          </div>
        ) : (
          rows.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-nexus-bright">
                  {p.identificador}
                </span>
                <span
                  className={
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                    STATUS_CHIP[p.status]
                  }
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-white">{p.clienteNome}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                  {formatBRL(p.valorTotal)}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/50">
                <span>{formatDateBR(p.dataProposta)}</span>
                {p.destino && <><span>·</span><span>{p.destino}</span></>}
              </div>
              <div className="mt-3 flex justify-end border-t border-white/[0.04] pt-3">
                <PropostaRowActions
                  proposta={{
                    id: p.id,
                    identificador: p.identificador,
                    status: p.status,
                    clienteNome: p.clienteNome,
                    podeEditar,
                    podeExcluir,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
