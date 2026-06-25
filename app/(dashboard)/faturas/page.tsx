import type { Metadata } from "next"
import { ScrollText } from "lucide-react"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { formatBRL } from "@/lib/utils/sum-parser"
import { formatDateBr } from "@/lib/utils/formatters"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { GerarFaturaButton } from "@/components/financeiro/gerar-fatura-button"
import { GerarFaturaModalTrigger } from "@/components/financeiro/gerar-fatura-modal-trigger"
import { FaturaRowActions } from "@/components/faturas/fatura-row-actions"
import { getFaturas } from "./actions"
import { getCaixas } from "@/app/(dashboard)/cartoes/actions"
import { getClientesComParcelasPendentes } from "@/app/(dashboard)/financeiro/actions"

export const metadata: Metadata = { title: "Faturas" }

const STATUS_LABEL: Record<string, string> = {
  gerada: "Gerada",
  enviada: "Enviada",
  paga: "Paga",
  cancelada: "Cancelada",
}

const STATUS_CLASS: Record<string, string> = {
  gerada: "border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright",
  enviada: "border-amber-500/25 bg-amber-500/[0.08] text-amber-400",
  paga: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400",
  cancelada: "border-rose-500/25 bg-rose-500/[0.08] text-rose-400",
}

export default async function FaturasPage() {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver faturas.
      </div>
    )
  }

  const podeEditar = can(user, "financeiro", "editar")
  const podeCriar = can(user, "financeiro", "criar")
  // `clientesFatura` só é buscado quando o usuário pode criar fatura,
  // pra não onerar a página de quem só visualiza.
  const [faturas, caixas, clientesFatura] = await Promise.all([
    getFaturas(),
    getCaixas(),
    podeCriar ? getClientesComParcelasPendentes() : Promise.resolve([]),
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <ScrollText className="h-6 w-6 text-nexus-bright" />
            Faturas
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Faturas agrupadas geradas a partir das contas a receber.
          </p>
        </div>
        {/* Espelha o botão de "Gerar Fatura" disponível em /financeiro/receber
            (mesmo trigger, mesma lista de clientes com parcelas pendentes). */}
        {podeCriar && <GerarFaturaModalTrigger clientes={clientesFatura} />}
      </div>

      {faturas.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <ScrollText className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm text-white/55">Nenhuma fatura gerada ainda.</p>
          <p className="mt-1 text-xs text-white/30">
            Gere faturas em Contas a Receber usando o botão "Gerar Fatura".
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] text-[10px] uppercase tracking-wider text-white/45">
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emitida em</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.map((f) => (
                <TableRow key={f.id} className="border-white/[0.04] hover:bg-white/[0.025]">
                  <TableCell className="font-mono text-xs text-nexus-bright">
                    {f.numero_display}
                  </TableCell>
                  <TableCell className="text-sm text-white">{f.clienteNome}</TableCell>
                  <TableCell className="text-sm text-white/70">
                    {formatDateBr(f.data_emissao)}
                    {f.status === "paga" && f.dataPagamento && (
                      <span className="block text-[10px] text-emerald-300/70">
                        pago {formatDateBr(f.dataPagamento)}
                        {f.caixaNome ? ` · ${f.caixaNome}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-white/70">
                    {f.numeroParcelas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium text-white">
                    {formatBRL(f.valor_total)}
                  </TableCell>
                  <TableCell>
                    <span className={[
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      STATUS_CLASS[f.status] ?? STATUS_CLASS.gerada,
                    ].join(" ")}>
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <GerarFaturaButton faturaId={f.id} />
                      {podeEditar && f.status !== "paga" && f.status !== "cancelada" && (
                        <FaturaRowActions
                          faturaId={f.id}
                          faturaNumero={f.numero_display}
                          valorTotal={f.valor_total}
                          caixas={caixas}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
