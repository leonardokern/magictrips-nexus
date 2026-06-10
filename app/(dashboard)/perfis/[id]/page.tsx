import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Briefcase, Building2, ChevronLeft, Percent, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { DeletePerfilButton } from "@/components/perfis/delete-perfil-button"
import { EditarPerfilButton } from "@/components/perfis/editar-perfil-button"
import { PermissoesTable } from "@/components/perfis/permissoes-table"
import {
  PerfilAtivoBadge,
  PerfilSistemaBadge,
} from "@/components/perfis/perfil-badges"
import type { PerfilTipo, PermissoesValue } from "@/lib/schemas/perfil"

export const metadata: Metadata = {
  title: "Perfil",
}

export default async function PerfilDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Apenas o Administrador pode gerenciar perfis.
      </div>
    )
  }

  const { id } = await params
  const supabase = await createClient()
  const agendaEnabled = await isFeatureEnabled("agenda")

  const [perfilRes, empresasRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("perfis_acesso")
      .select(
        "id, nome, sistema, ativo, empresa_id, tipo, permissoes, chave_sistema",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("empresas")
      .select("id, nome, slug")
      .eq("ativo", true)
      .order("nome"),
  ])

  const perfil = perfilRes.data
  if (!perfil) notFound()

  const empresas = empresasRes.data ?? []
  const empresaNome = perfil.empresa_id
    ? empresas.find((e) => e.id === perfil.empresa_id)?.nome ?? "—"
    : "Todas as empresas"

  // Carrega overrides + regras da empresa pra exibir matriz efetiva
  const [
    { data: overridesData },
    { data: regrasData },
    { count: usuariosCount },
  ] = await Promise.all([
    supabase
      .from("perfis_comissoes")
      .select("origem_id, percentual")
      .eq("perfil_id", perfil.id),
    perfil.empresa_id
      ? supabase
          .from("comissoes_regras")
          .select("origem_id, percentual, origens_venda(nome, ordem)")
          .eq("empresa_id", perfil.empresa_id)
      : Promise.resolve({
          data: [] as {
            origem_id: string
            percentual: number
            origens_venda: { nome: string; ordem: number } | null
          }[],
        }),
    supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("perfil_id", id),
  ])

  const overridesMap: Record<string, number> = {}
  for (const o of overridesData ?? []) {
    overridesMap[o.origem_id] = Number(o.percentual)
  }

  const regrasOrdenadas = [...(regrasData ?? [])]
    .map((r) => ({
      origem_id: r.origem_id,
      nome: r.origens_venda?.nome ?? "—",
      ordem: r.origens_venda?.ordem ?? 0,
      percentual: Number(r.percentual),
    }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))

  const podeExcluir =
    can(user, "perfis", "excluir") && !perfil.sistema && (usuariosCount ?? 0) === 0
  const podeEditar =
    can(user, "perfis", "editar") &&
    (perfil as { chave_sistema?: string | null }).chave_sistema !== "admin"

  const permissoes = (perfil.permissoes as PermissoesValue) ?? {}
  const tipo = perfil.tipo as PerfilTipo
  const tipoLabel =
    tipo === "agente" ? "Agente" : tipo === "marketing" ? "Marketing" : "Operação"
  const tipoChip =
    tipo === "agente"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : tipo === "marketing"
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
        : "border-nexus-bright/30 bg-nexus-bright/10 text-nexus-bright"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/perfis"
          className="inline-flex items-center text-sm text-white/55 hover:text-white"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Perfis de acesso
        </Link>
        <div className="flex items-center gap-2">
          {podeEditar && (
            <EditarPerfilButton
              id={perfil.id}
              initial={{
                nome: perfil.nome,
                tipo,
                empresa_id: perfil.empresa_id,
                permissoes,
                comissoes: overridesMap,
              }}
              empresas={empresas}
              agendaEnabled={agendaEnabled}
            />
          )}
          {podeExcluir && (
            <DeletePerfilButton perfilId={perfil.id} perfilNome={perfil.nome} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {perfil.nome}
        </h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tipoChip}`}
        >
          {tipoLabel}
        </span>
        <PerfilSistemaBadge sistema={perfil.sistema} />
        <PerfilAtivoBadge ativo={perfil.ativo} />
      </div>
      <p className="text-sm text-white/55">
        {usuariosCount ?? 0}{" "}
        {usuariosCount === 1
          ? "usuário neste perfil"
          : "usuários neste perfil"}
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Briefcase className="h-4 w-4 text-nexus-bright" />
              Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/75">{tipoLabel}</p>
            <p className="mt-1 text-xs text-white/45">
              {tipo === "agente"
                ? "Vinculado a 1 empresa, com matriz de comissão própria."
                : "Cross-empresa, sem regra de comissão."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Building2 className="h-4 w-4 text-nexus-bright" />
              Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/75">{empresaNome}</p>
            <p className="mt-1 text-xs text-white/45">
              {perfil.empresa_id
                ? "Usuários com este perfil ficam restritos a essa empresa."
                : "Usuários podem ter acesso a qualquer combinação de empresas."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <ShieldCheck className="h-4 w-4 text-nexus-bright" />
              Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/75">
              {perfil.sistema ? "Perfil do sistema" : "Perfil customizado"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {perfil.sistema
                ? "Não pode ser excluído. Nome bloqueado."
                : "Pode ser editado, desativado e excluído (sem usuários)."}
            </p>
          </CardContent>
        </Card>
      </div>

      {tipo === "agente" && regrasOrdenadas.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
            <Percent className="h-4 w-4 text-nexus-bright" />
            Comissão por origem
          </h3>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="border-b border-white/[0.06] px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/55">
                    Origem
                  </th>
                  <th className="border-b border-white/[0.06] px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-white/55">
                    Padrão da empresa
                  </th>
                  <th className="border-b border-white/[0.06] px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-white/55">
                    Valor efetivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {regrasOrdenadas.map((r) => {
                  const override = overridesMap[r.origem_id]
                  const efetivo = override ?? r.percentual
                  const customizado = override !== undefined
                  return (
                    <tr
                      key={r.origem_id}
                      className="transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="border-b border-white/[0.04] px-4 py-2.5 text-sm text-white/85">
                        {r.nome}
                      </td>
                      <td className="border-b border-white/[0.04] px-4 py-2.5 text-right text-sm tabular-nums text-white/55">
                        {r.percentual.toFixed(1)}%
                      </td>
                      <td
                        className={
                          "border-b border-white/[0.04] px-4 py-2.5 text-right text-sm tabular-nums " +
                          (customizado
                            ? "font-medium text-nexus-bright"
                            : "text-white/75")
                        }
                      >
                        {efetivo.toFixed(1)}%
                        {customizado && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-nexus-bright/70">
                            override
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
          <ShieldCheck className="h-4 w-4 text-nexus-bright" />
          Permissões
        </h3>
        <PermissoesTable
          value={permissoes}
          onChange={() => {}}
          disabled
          readOnlyAllTrue={
            (perfil as { chave_sistema?: string | null }).chave_sistema ===
            "admin"
          }
          agendaEnabled={agendaEnabled}
        />
      </div>
    </div>
  )
}
