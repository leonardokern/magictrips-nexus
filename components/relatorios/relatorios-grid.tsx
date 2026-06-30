import Link from "next/link"
import { ArrowRight, Boxes, HandCoins, type LucideIcon } from "lucide-react"

type RelatorioDef = {
  slug: string
  titulo: string
  descricao: string
  icon: LucideIcon
}

const RELATORIOS: RelatorioDef[] = [
  {
    slug: "tipo-produto",
    titulo: "Vendas por tipo de produto",
    descricao:
      "Vendas aprovadas de um tipo de produto (Aéreo, Hotel…) num intervalo, com valores, custo, RAVs, clientes e campos customizados.",
    icon: Boxes,
  },
  {
    slug: "comissao",
    titulo: "Relatório de Comissão",
    descricao:
      "Comissões de cada agente num período, incluindo agentes sem vendas (valor zero). Exporta em Excel ou PDF.",
    icon: HandCoins,
  },
]

export function RelatoriosGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {RELATORIOS.map((r) => {
        const Icon = r.icon
        return (
          <Link
            key={r.slug}
            href={`/relatorios/${r.slug}`}
            className="group flex flex-col items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition-colors hover:border-nexus-bright/30 hover:bg-white/[0.04]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-nexus-bright/25 bg-nexus-bright/[0.08] text-nexus-bright transition-colors group-hover:bg-nexus-bright/15">
              <Icon className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">{r.titulo}</h3>
              <p className="text-xs leading-relaxed text-white/55">{r.descricao}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-nexus-bright">
              Abrir relatório
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )
      })}
    </div>
  )
}
