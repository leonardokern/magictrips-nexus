import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { PerfilForm } from "@/components/perfis/perfil-form"

export const metadata: Metadata = {
  title: "Novo perfil",
}

export default async function NovoPerfilPage() {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "criar")) redirect("/perfis")

  return (
    <div className="space-y-6">
      <Link
        href="/perfis"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Perfis de acesso
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Novo perfil</h2>
        <p className="text-sm text-muted-foreground">
          Crie um perfil customizado com permissões granulares por módulo.
        </p>
      </div>

      <PerfilForm mode="create" />
    </div>
  )
}
