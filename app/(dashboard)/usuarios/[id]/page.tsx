import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Building2,
  ChevronLeft,
  Mail,
  Pencil,
  Percent,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import {
  PerfilUsuarioBadge,
  UsuarioAtivoBadge,
} from "@/components/usuarios/usuario-badges"
import { UsuarioAcoes } from "@/components/usuarios/usuario-acoes"

export const metadata: Metadata = {
  title: "Usuário",
}

export default async function UsuarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireCurrentUser()
  const { id } = await params

  if (!can(user, "usuarios", "ler")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para ver usuários.
      </div>
    )
  }

  const supabase = await createClient()
  const { data: u } = await supabase
    .from("usuarios")
    .select(
      "id, nome, email, iniciais, ativo, force_password_change, perfil_id, empresa_id, comissao_percentual, created_at",
    )
    .eq("id", id)
    .maybeSingle()

  if (!u) notFound()

  const [{ data: perfil }, { data: empresa }] = await Promise.all([
    supabase.from("perfis_acesso").select("nome").eq("id", u.perfil_id).single(),
    u.empresa_id
      ? supabase.from("empresas").select("nome").eq("id", u.empresa_id).single()
      : Promise.resolve({ data: null }),
  ])

  const isSelf = u.id === user.id
  const permEditar = can(user, "usuarios", "editar")
  const permExcluir = can(user, "usuarios", "excluir")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/usuarios"
          className="inline-flex items-center text-sm text-white/55 hover:text-white"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Usuários
        </Link>

        {permEditar && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white"
          >
            <Link href={`/usuarios/${u.id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        )}
      </div>

      {/* Cabeçalho do perfil */}
      <div className="flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg font-semibold text-white">
          {u.iniciais ?? u.nome.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {u.nome}
              {isSelf && (
                <span className="ml-2 text-xs font-normal text-white/45">
                  (você)
                </span>
              )}
            </h2>
            <PerfilUsuarioBadge nome={perfil?.nome ?? "—"} />
            <UsuarioAtivoBadge ativo={u.ativo} />
            {u.force_password_change && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                Senha provisória pendente
              </span>
            )}
          </div>
          <p className="text-sm text-white/55">{u.email}</p>
        </div>
      </div>

      {/* Cards de detalhes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-base text-white">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<Mail className="h-4 w-4" />} label="E-mail">
              <a
                href={`mailto:${u.email}`}
                className="text-white hover:underline"
              >
                {u.email}
              </a>
            </Row>
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Iniciais">
              <code className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-white">
                {u.iniciais ?? "—"}
              </code>
            </Row>
            <Row label="Cadastrado em">
              {new Date(u.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Row>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-base text-white">Acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Perfil">
              <PerfilUsuarioBadge nome={perfil?.nome ?? "—"} />
            </Row>
            <Row icon={<Building2 className="h-4 w-4" />} label="Empresa">
              {empresa?.nome ?? (
                <span className="text-white/60">Todas (Administrador)</span>
              )}
            </Row>
            <Row icon={<Percent className="h-4 w-4" />} label="Comissão">
              {u.comissao_percentual != null ? (
                <span>{u.comissao_percentual}% fixo</span>
              ) : (
                <span className="text-white/55">Régua padrão 30/40/50%</span>
              )}
            </Row>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      {(permEditar || permExcluir) && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-base text-white">Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <UsuarioAcoes
              id={u.id}
              nome={u.nome}
              ativo={u.ativo}
              isSelf={isSelf}
              permEditar={permEditar}
              permExcluir={permExcluir}
            />
            {isSelf && (
              <p className="mt-3 text-xs text-white/45">
                Para trocar a sua própria senha, use o link de troca no menu.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="mt-0.5 shrink-0 text-white/45">{icon}</div>
      )}
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-white/45">
          {label}
        </p>
        <div className="mt-0.5 text-white">{children}</div>
      </div>
    </div>
  )
}
