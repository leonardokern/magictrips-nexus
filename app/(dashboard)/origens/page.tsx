import type { Metadata } from "next"
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
import { NovoOrigemButton } from "@/components/origens/novo-origem-button"
import { OrigemRowActions } from "@/components/origens/origem-row-actions"

export const metadata: Metadata = {
  title: "Origens de venda",
}

export default async function OrigensPage() {
  const user = await requireCurrentUser()
  if (!can(user, "comissoes", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Apenas o Administrador pode gerenciar origens de venda.
      </div>
    )
  }

  const podeEditar = can(user, "comissoes", "editar")
  const supabase = await createClient()

  const [{ data: origens }, { data: empresas }, { data: regras }] =
    await Promise.all([
      supabase
        .from("origens_venda")
        .select("id, nome, ativo, ordem, created_at")
        .order("ordem")
        .order("nome"),
      supabase
        .from("empresas")
        .select("id, nome, slug")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("comissoes_regras")
        .select("empresa_id, origem_id, percentual"),
    ])

  // Indexa (origem_id, empresa_id) → percentual
  const idx = new Map<string, number>()
  for (const r of regras ?? []) {
    idx.set(`${r.origem_id}::${r.empresa_id}`, Number(r.percentual))
  }

  const empresasList = empresas ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Origens de venda
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Catálogo das origens de lead usadas nas vendas. Cada origem tem um
            percentual de comissão padrão por empresa — esse valor é o default
            aplicado a vendas e a perfis agente.
          </p>
        </div>

        {podeEditar && <NovoOrigemButton empresas={empresasList} />}
      </div>

      {/* ── Desktop: tabela ─────────────────────────────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Origem</TableHead>
              {empresasList.map((e) => (
                <TableHead
                  key={e.id}
                  className="text-right text-white/55"
                >
                  {e.nome}
                </TableHead>
              ))}
              {podeEditar && (
                <TableHead className="text-right text-white/55">Ações</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!origens || origens.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={empresasList.length + (podeEditar ? 2 : 1)}
                  className="h-24 text-center text-sm text-white/45"
                >
                  Nenhuma origem cadastrada. Clique em &quot;Nova origem&quot;
                  para adicionar a primeira.
                </TableCell>
              </TableRow>
            ) : (
              origens.map((o) => {
                const comissoesMap: Record<string, number> = {}
                for (const emp of empresasList) {
                  comissoesMap[emp.id] = idx.get(`${o.id}::${emp.id}`) ?? 0
                }
                return (
                  <TableRow
                    key={o.id}
                    className="border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell className="font-medium text-white">
                      {o.nome}
                      {!o.ativo && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-white/40">
                          inativo
                        </span>
                      )}
                    </TableCell>
                    {empresasList.map((emp) => {
                      const p = comissoesMap[emp.id]
                      return (
                        <TableCell
                          key={emp.id}
                          className="text-right text-sm tabular-nums text-white/85"
                        >
                          {p !== undefined ? `${p.toFixed(1)}%` : "—"}
                        </TableCell>
                      )
                    })}
                    {podeEditar && (
                      <TableCell className="text-right">
                        <OrigemRowActions
                          origem={{
                            id: o.id,
                            nome: o.nome,
                            comissoes: comissoesMap,
                          }}
                          empresas={empresasList}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile: cards ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {!origens || origens.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center text-sm text-white/45">
            Nenhuma origem cadastrada.
          </div>
        ) : (
          origens.map((o) => {
            const comissoesMap: Record<string, number> = {}
            for (const emp of empresasList) {
              comissoesMap[emp.id] = idx.get(`${o.id}::${emp.id}`) ?? 0
            }
            return (
              <div
                key={o.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white leading-tight">
                    {o.nome}
                  </p>
                  {!o.ativo && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/40">
                      inativo
                    </span>
                  )}
                </div>

                <div className="mt-2.5 space-y-1">
                  {empresasList.map((emp) => {
                    const p = comissoesMap[emp.id]
                    return (
                      <div key={emp.id} className="flex items-center justify-between text-xs">
                        <span className="text-white/55">{emp.nome}</span>
                        <span className="tabular-nums font-medium text-white/85">
                          {p !== undefined ? `${p.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {podeEditar && (
                  <div className="mt-3 flex justify-end border-t border-white/[0.04] pt-3">
                    <OrigemRowActions
                      origem={{
                        id: o.id,
                        nome: o.nome,
                        comissoes: comissoesMap,
                      }}
                      empresas={empresasList}
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
