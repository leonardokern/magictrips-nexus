import Link from "next/link"
import { FileText } from "lucide-react"

/**
 * Botão de link direto para o PDF de uma fatura já criada.
 * Exibido por linha na tabela de parcelas quando a parcela já tem fatura.
 */
export function GerarFaturaButton({ faturaId }: { faturaId: string }) {
  return (
    <Link
      href={`/api/faturas/${faturaId}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir fatura em PDF"
      aria-label="Abrir fatura em PDF"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
    >
      <FileText className="h-3.5 w-3.5" />
    </Link>
  )
}
