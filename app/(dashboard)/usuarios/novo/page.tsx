import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { UsuarioForm } from "@/components/usuarios/usuario-form"

export const metadata: Metadata = {
  title: "Novo usuário",
}

export default async function NovoUsuarioPage() {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "criar")) redirect("/usuarios")

  const supabase = await createClient()
  const [{ data: perfis }, { data: empresas }] = await Promise.all([
    supabase.from("perfis_acesso").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
  ])

  return (
    <div className="space-y-6">
      <Link
        href="/usuarios"
        className="inline-flex items-center text-sm text-white/55 hover:text-white"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Usuários
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Novo usuário
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Após criar, uma senha provisória será exibida — copie e envie ao usuário.
          Ele será obrigado a trocá-la no primeiro acesso.
        </p>
      </div>

      <UsuarioForm
        mode="create"
        perfis={perfis ?? []}
        empresas={empresas ?? []}
      />
    </div>
  )
}
