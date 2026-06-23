import Link from "next/link"
import { FileText } from "lucide-react"

/**
 * Botão "Gerar fatura" — abre o PDF da fatura em uma nova guia. Usa
 * `<Link target="_blank">` pra que o browser trate como navegação e
 * monte o PDF inline em vez de baixar.
 *
 * Restrito no caller — só renderizar pra parcelas com forma de
 * pagamento diferente de `link_externo`.
 */
export function GerarFaturaButton({ parcelaId }: { parcelaId: string }) {
  return (
    <Link
      href={`/api/parcelas/${parcelaId}/fatura`}
      target="_blank"
      rel="noopener noreferrer"
      title="Gerar fatura em PDF"
      aria-label="Gerar fatura em PDF"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors hover:border-nexus-bright/50 hover:bg-nexus-bright/15"
    >
      <FileText className="h-3.5 w-3.5" />
    </Link>
  )
}
