import Link from "next/link"
import { ExternalLink, Pencil } from "lucide-react"
import { formatBRL } from "@/lib/utils/sum-parser"
import { cn } from "@/lib/utils"

type Produto = {
  tipo_produto_nome: string
  fornecedor_nome: string | null
  valor_venda: number | string | null
  valor_custo: number | string | null
  rav: number | string | null
}

type Props = {
  vendaOriginal: {
    id: string
    identificador: string
    produtos: Produto[]
  }
  alteracao: {
    produtos: Produto[]
  }
}

/**
 * Card de comparação Original / Δ / Efetivo — exibido em cima da página de
 * detalhe da venda quando `tipo_venda === 'alteracao_valores'`.
 *
 * Match de produtos é por tipo_produto_nome — pode haver linhas "só na
 * alteração" (produto novo) ou "só no original" (produto removido cujo delta
 * negativo zera o efetivo). Linhas que aparecem só no original com efetivo
 * 0 são exibidas como "removidos" em rosa.
 */
export function AlteracaoComparisonCard({ vendaOriginal, alteracao }: Props) {
  // Agrega valores por tipo_produto_nome em cada lado
  type Agreg = { venda: number; custo: number; rav: number }
  const zero = (): Agreg => ({ venda: 0, custo: 0, rav: 0 })

  const origPorTipo = new Map<string, Agreg>()
  for (const p of vendaOriginal.produtos) {
    const k = p.tipo_produto_nome
    const a = origPorTipo.get(k) ?? zero()
    a.venda += Number(p.valor_venda ?? 0)
    a.custo += Number(p.valor_custo ?? 0)
    a.rav += Number(p.rav ?? 0)
    origPorTipo.set(k, a)
  }

  const altPorTipo = new Map<string, Agreg>()
  for (const p of alteracao.produtos) {
    const k = p.tipo_produto_nome
    const a = altPorTipo.get(k) ?? zero()
    a.venda += Number(p.valor_venda ?? 0)
    a.custo += Number(p.valor_custo ?? 0)
    a.rav += Number(p.rav ?? 0)
    altPorTipo.set(k, a)
  }

  const tipos = Array.from(
    new Set([...origPorTipo.keys(), ...altPorTipo.keys()]),
  ).sort()

  const totaisOrig = zero()
  const totaisAlt = zero()
  for (const a of origPorTipo.values()) {
    totaisOrig.venda += a.venda
    totaisOrig.custo += a.custo
    totaisOrig.rav += a.rav
  }
  for (const a of altPorTipo.values()) {
    totaisAlt.venda += a.venda
    totaisAlt.custo += a.custo
    totaisAlt.rav += a.rav
  }
  const totaisEfet = {
    venda: totaisOrig.venda + totaisAlt.venda,
    custo: totaisOrig.custo + totaisAlt.custo,
    rav: totaisOrig.rav + totaisAlt.rav,
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Pencil className="h-4 w-4 text-amber-300" />
          Alteração de valores
        </h3>
        <Link
          href={`/vendas/${vendaOriginal.id}`}
          className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
        >
          Ver venda original ({vendaOriginal.identificador})
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <div className="grid grid-cols-12 gap-2 border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          <div className="col-span-3">Produto</div>
          <div className="col-span-3 text-right">Receita (orig → Δ → efetivo)</div>
          <div className="col-span-3 text-right">Custo (orig → Δ → efetivo)</div>
          <div className="col-span-3 text-right">RAV (orig → Δ → efetivo)</div>
        </div>
        <ul className="divide-y divide-white/[0.04]">
          {tipos.map((nome) => {
            const o = origPorTipo.get(nome) ?? zero()
            const a = altPorTipo.get(nome) ?? zero()
            const ef = {
              venda: o.venda + a.venda,
              custo: o.custo + a.custo,
              rav: o.rav + a.rav,
            }
            const novo = o.venda === 0 && o.custo === 0 && o.rav === 0
            return (
              <li
                key={nome}
                className="grid grid-cols-12 gap-2 px-3 py-2 text-xs"
              >
                <div className="col-span-3 truncate text-white/85">
                  {nome}
                  {novo && (
                    <span className="ml-1.5 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                      novo
                    </span>
                  )}
                </div>
                <DeltaTriple
                  className="col-span-3"
                  original={o.venda}
                  delta={a.venda}
                  efetivo={ef.venda}
                />
                <DeltaTriple
                  className="col-span-3"
                  original={o.custo}
                  delta={a.custo}
                  efetivo={ef.custo}
                  invertido
                />
                <DeltaTriple
                  className="col-span-3"
                  original={o.rav}
                  delta={a.rav}
                  efetivo={ef.rav}
                />
              </li>
            )
          })}
          <li className="grid grid-cols-12 gap-2 border-t border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs font-semibold">
            <div className="col-span-3 uppercase tracking-wider text-white/55">
              Totais
            </div>
            <DeltaTriple
              className="col-span-3"
              original={totaisOrig.venda}
              delta={totaisAlt.venda}
              efetivo={totaisEfet.venda}
            />
            <DeltaTriple
              className="col-span-3"
              original={totaisOrig.custo}
              delta={totaisAlt.custo}
              efetivo={totaisEfet.custo}
              invertido
            />
            <DeltaTriple
              className="col-span-3"
              original={totaisOrig.rav}
              delta={totaisAlt.rav}
              efetivo={totaisEfet.rav}
            />
          </li>
        </ul>
      </div>
    </div>
  )
}

function DeltaTriple({
  className,
  original,
  delta,
  efetivo,
  invertido,
}: {
  className?: string
  original: number
  delta: number
  efetivo: number
  /** Se true (ex: custo), + é ruim e - é bom. */
  invertido?: boolean
}) {
  const positivoBom = invertido ? delta < 0 : delta > 0
  const deltaColor =
    delta === 0
      ? "text-white/30"
      : positivoBom
        ? "text-emerald-300"
        : "text-amber-300"
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1.5 tabular-nums",
        className,
      )}
    >
      <span className="text-white/45">{formatBRL(original)}</span>
      <span className="text-white/30">→</span>
      <span className={cn("font-medium", deltaColor)}>
        {delta === 0
          ? "—"
          : delta > 0
            ? `+${formatBRL(delta)}`
            : `-${formatBRL(Math.abs(delta))}`}
      </span>
      <span className="text-white/30">→</span>
      <span className="font-semibold text-white">{formatBRL(efetivo)}</span>
    </div>
  )
}
