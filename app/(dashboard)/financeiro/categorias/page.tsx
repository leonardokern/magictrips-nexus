import type { Metadata } from "next"
import Link from "next/link"
import { Tag, ArrowLeft } from "lucide-react"
import { redirect } from "next/navigation"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { listarTodasCategorias } from "@/app/(dashboard)/financeiro/actions"
import { CategoriasPageClient } from "@/components/financeiro/categorias-page-client"

export const metadata: Metadata = { title: "Categorias Financeiras" }

type SearchParams = Promise<{ from?: string }>

export default async function CategoriasFinanceirasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()

  if (!can(user, "financeiro", "editar")) {
    redirect("/financeiro/receber")
  }

  const sp = await searchParams
  const from = sp.from === "pagar" ? "pagar" : "receber"
  const backHref = `/financeiro/${from}`
  const backLabel = from === "pagar" ? "Contas a Pagar" : "Contas a Receber"

  const categorias = await listarTodasCategorias()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
          <Tag className="h-6 w-6 text-nexus-bright" />
          Categorias Financeiras
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Organize as categorias usadas em lançamentos manuais de receitas e despesas.
        </p>
      </div>

      <CategoriasPageClient initialCategorias={categorias} />
    </div>
  )
}
