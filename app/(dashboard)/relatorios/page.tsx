import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { RelatoriosGrid } from "@/components/relatorios/relatorios-grid"

export const metadata: Metadata = {
  title: "Relatórios",
}

export default async function RelatoriosPage() {
  const user = await requireCurrentUser()
  if (!can(user, "relatorios", "ver")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para acessar relatórios.
      </div>
    )
  }

  const supabase = await createClient()
  const { data: tipos } = await supabase
    .from("tipos_produto")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Relatórios
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Gere relatórios gerenciais a partir das vendas aprovadas. Clique em um
          relatório para escolher os filtros e exportar em Excel ou PDF.
        </p>
      </div>

      <RelatoriosGrid tipos={tipos ?? []} />
    </div>
  )
}
