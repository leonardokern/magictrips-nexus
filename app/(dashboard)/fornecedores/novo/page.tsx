import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { FornecedorForm } from "@/components/fornecedores/fornecedor-form"

export const metadata: Metadata = {
  title: "Novo fornecedor",
}

export default async function NovoFornecedorPage() {
  const user = await requireCurrentUser()
  if (!can(user, "fornecedores", "criar")) redirect("/fornecedores")

  return (
    <div className="space-y-6">
      <Link
        href="/fornecedores"
        className="inline-flex items-center text-sm text-white/55 hover:text-white"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Fornecedores
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Novo fornecedor
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Cadastre um fornecedor (CNPJ único). Fornecedores ativos aparecem nos
          dropdowns de seleção das vendas.
        </p>
      </div>

      <FornecedorForm mode="create" />
    </div>
  )
}
