import type { Metadata } from "next"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { RelatorioComissaoView } from "@/components/relatorios/relatorio-comissao-view"

export const metadata: Metadata = {
  title: "Relatório de Comissão",
}

export default async function RelatorioComissaoPage() {
  const user = await requireCurrentUser()
  if (!can(user, "relatorios", "ver")) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Você não tem permissão para acessar relatórios.
      </div>
    )
  }

  return <RelatorioComissaoView />
}
