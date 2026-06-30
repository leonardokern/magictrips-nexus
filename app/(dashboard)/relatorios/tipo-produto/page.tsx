import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { RelatorioTipoProdutoView } from "@/components/relatorios/relatorio-tipo-produto-view"

export const metadata: Metadata = {
  title: "Vendas por tipo de produto",
}

export default async function RelatorioTipoProdutoPage() {
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

  return <RelatorioTipoProdutoView tipos={tipos ?? []} />
}
