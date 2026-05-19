import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { UsuarioForm } from "@/components/usuarios/usuario-form"

export const metadata: Metadata = {
  title: "Editar usuário",
}

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "editar")) redirect("/usuarios")

  const { id } = await params
  const supabase = await createClient()

  const [{ data: u }, { data: perfis }, { data: empresas }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nome, email, iniciais, perfil_id, empresa_id, comissao_percentual")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("perfis_acesso").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
  ])

  if (!u) notFound()

  return (
    <div className="space-y-6">
      <Link
        href={`/usuarios/${u.id}`}
        className="inline-flex items-center text-sm text-white/55 hover:text-white"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        {u.nome}
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Editar usuário
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Atualize perfil, empresa, iniciais ou comissão. Para resetar senha, use
          a ação na tela de detalhe.
        </p>
      </div>

      <UsuarioForm
        mode="edit"
        id={u.id}
        perfis={perfis ?? []}
        empresas={empresas ?? []}
        initial={{
          nome: u.nome,
          email: u.email,
          iniciais: u.iniciais,
          perfil_id: u.perfil_id,
          empresa_id: u.empresa_id,
          comissao_percentual: u.comissao_percentual,
        }}
      />
    </div>
  )
}
