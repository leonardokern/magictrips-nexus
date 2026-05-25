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
import { PerfilAtivoBadge } from "@/components/perfis/perfil-badges"
import { NovoPerfilButton } from "@/components/perfis/novo-perfil-button"
import { PerfilRowActions } from "@/components/perfis/perfil-row-actions"
import type { PerfilTipo, PermissoesValue } from "@/lib/schemas/perfil"

export const metadata: Metadata = {
  title: "Perfis de acesso",
}

export default async function PerfisPage() {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Apenas o Administrador pode gerenciar perfis de acesso.
      </div>
    )
  }

  const supabase = await createClient()

  const [{ data: perfis }, { data: empresas }] = await Promise.all([
    supabase
      .from("perfis_acesso")
      .select(
        "id, nome, sistema, ativo, empresa_id, tipo, permissoes, created_at",
      )
      .order("sistema", { ascending: false })
      .order("nome"),
    supabase
      .from("empresas")
      .select("id, nome, slug")
      .eq("ativo", true)
      .order("nome"),
  ])

  const perfilIds = (perfis ?? []).map((p) => p.id)

  // Batch: contagem de usuários + overrides de comissão para todos os perfis
  const [overridesRes, ...countResults] = await Promise.all([
    perfilIds.length > 0
      ? supabase
          .from("perfis_comissoes")
          .select("perfil_id, origem_id, percentual")
          .in("perfil_id", perfilIds)
      : Promise.resolve({
          data: [] as {
            perfil_id: string
            origem_id: string
            percentual: number
          }[],
        }),
    ...perfilIds.map((id) =>
      supabase
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .eq("perfil_id", id),
    ),
  ])

  const usuariosPorPerfil = new Map<string, number>()
  perfilIds.forEach((id, idx) => {
    const r = countResults[idx]
    if (r) usuariosPorPerfil.set(id, r.count ?? 0)
  })

  const overridesPorPerfil = new Map<string, Record<string, number>>()
  for (const o of overridesRes.data ?? []) {
    const cur = overridesPorPerfil.get(o.perfil_id) ?? {}
    cur[o.origem_id] = Number(o.percentual)
    overridesPorPerfil.set(o.perfil_id, cur)
  }

  const podeEditar = can(user, "perfis", "editar")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Perfis de acesso
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Defina o que cada perfil pode fazer em cada módulo do sistema. O
            perfil Administrador é o único read-only.
          </p>
        </div>

        {can(user, "perfis", "criar") && (
          <NovoPerfilButton empresas={empresas ?? []} />
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55">Nome</TableHead>
              <TableHead className="text-white/55">Tipo</TableHead>
              <TableHead className="text-white/55">Status</TableHead>
              <TableHead className="text-white/55">Usuários</TableHead>
              <TableHead className="text-right text-white/55">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!perfis || perfis.length === 0 ? (
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-sm text-white/45"
                >
                  Nenhum perfil cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              perfis.map((p) => {
                const tipoLabel = p.tipo === "agente" ? "Agente" : "Operação"
                const tipoChip =
                  p.tipo === "agente"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright"
                const usuariosCount = usuariosPorPerfil.get(p.id) ?? 0
                return (
                  <TableRow
                    key={p.id}
                    className="border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <TableCell className="font-medium text-white">
                      {p.nome}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tipoChip}`}
                      >
                        {tipoLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PerfilAtivoBadge ativo={p.ativo} />
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {usuariosCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <PerfilRowActions
                        perfil={{
                          id: p.id,
                          nome: p.nome,
                          tipo: p.tipo as PerfilTipo,
                          empresa_id: p.empresa_id,
                          permissoes:
                            (p.permissoes as PermissoesValue) ?? {},
                          ativo: p.ativo,
                          sistema: p.sistema,
                          comissoes: overridesPorPerfil.get(p.id) ?? {},
                        }}
                        empresas={empresas ?? []}
                        usuariosCount={usuariosCount}
                        podeEditar={podeEditar}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden">
        {!perfis || perfis.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/45">
            Nenhum perfil cadastrado.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {perfis.map((p) => {
              const tipoLabel = p.tipo === "agente" ? "Agente" : "Operação"
              const tipoChip =
                p.tipo === "agente"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright"
              const usuariosCount = usuariosPorPerfil.get(p.id) ?? 0
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  {/* Row 1: nome + tipo badge */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{p.nome}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tipoChip}`}
                    >
                      {tipoLabel}
                    </span>
                  </div>
                  {/* Row 2: status + usuarios count */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <PerfilAtivoBadge ativo={p.ativo} />
                    <span className="text-xs text-white/55">
                      {usuariosCount === 1 ? "1 usuário" : `${usuariosCount} usuários`}
                    </span>
                  </div>
                  {/* Actions row */}
                  <div className="mt-3 flex items-center justify-end border-t border-white/[0.06] pt-3">
                    <PerfilRowActions
                      perfil={{
                        id: p.id,
                        nome: p.nome,
                        tipo: p.tipo as PerfilTipo,
                        empresa_id: p.empresa_id,
                        permissoes: (p.permissoes as PermissoesValue) ?? {},
                        ativo: p.ativo,
                        sistema: p.sistema,
                        comissoes: overridesPorPerfil.get(p.id) ?? {},
                      }}
                      empresas={empresas ?? []}
                      usuariosCount={usuariosCount}
                      podeEditar={podeEditar}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
