import type { Metadata } from "next"
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Relatórios
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Selecione um relatório para configurar os filtros, visualizar a prévia
          e exportar em Excel ou PDF.
        </p>
      </div>

      <RelatoriosGrid />
    </div>
  )
}
