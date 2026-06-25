import { Pencil } from "lucide-react"
import { formatBRL } from "@/lib/utils/sum-parser"
import { cn } from "@/lib/utils"
import { VerVendaOriginalButton } from "./ver-venda-original-button"

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
    /** Cliente + origem da venda original — quando informados e diferentes
     *  dos da alteração, o card destaca a mudança no topo. */
    clienteNome?: string
    origem?: string | null
    comissaoPercentual?: number | null
    produtos: Produto[]
  }
  alteracao: {
    clienteNome?: string
    origem?: string | null
    comissaoPercentual?: number | null
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

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Pencil className="h-4 w-4 text-amber-300" />
          Alteração de valores
        </h3>
        <VerVendaOriginalButton
          vendaId={vendaOriginal.id}
          identificador={vendaOriginal.identificador}
        />
      </div>

      {/* Bloco de mudanças de identificação — cliente, origem, %comissão.
          Renderiza só os campos que mudaram. Se nada mudou ali, o bloco
          some por completo (mantém o card menor pra alterações puras de
          valor). */}
      {(() => {
        const linhas: {
          label: string
          antes: string
          depois: string
        }[] = []
        if (
          vendaOriginal.clienteNome &&
          alteracao.clienteNome &&
          vendaOriginal.clienteNome !== alteracao.clienteNome
        ) {
          linhas.push({
            label: "Cliente",
            antes: vendaOriginal.clienteNome,
            depois: alteracao.clienteNome,
          })
        }
        if (
          (vendaOriginal.origem ?? "") !== (alteracao.origem ?? "") &&
          (vendaOriginal.origem || alteracao.origem)
        ) {
          linhas.push({
            label: "Origem",
            antes: vendaOriginal.origem ?? "—",
            depois: alteracao.origem ?? "—",
          })
        }
        if (
          vendaOriginal.comissaoPercentual != null &&
          alteracao.comissaoPercentual != null &&
          Math.abs(
            vendaOriginal.comissaoPercentual - alteracao.comissaoPercentual,
          ) > 0.001
        ) {
          linhas.push({
            label: "Comissão",
            antes: `${vendaOriginal.comissaoPercentual.toFixed(2).replace(".", ",")}%`,
            depois: `${alteracao.comissaoPercentual.toFixed(2).replace(".", ",")}%`,
          })
        }
        if (linhas.length === 0) return null
        return (
          <div className="mb-3 grid gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            {linhas.map((l) => (
              <div
                key={l.label}
                className="flex flex-wrap items-baseline gap-x-2 text-xs"
              >
                <span className="text-[10px] uppercase tracking-wider text-white/45">
                  {l.label}
                </span>
                <span className="text-white/45 line-through decoration-white/20">
                  {l.antes}
                </span>
                <span className="text-white/35">→</span>
                <span className="font-medium text-amber-300">{l.depois}</span>
              </div>
            ))}
          </div>
        )
      })()}

      <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
        {/* Header — só as 4 colunas, sem o subtítulo "(orig → Δ → efetivo)"
            que não cabia. A semântica fica nos rótulos das linhas (orig/Δ/efet). */}
        <div className="grid grid-cols-12 gap-2 border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          <div className="col-span-3">Produto</div>
          <div className="col-span-3 text-right">Receita</div>
          <div className="col-span-3 text-right">Custo</div>
          <div className="col-span-3 text-right">RAV</div>
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
                className="grid grid-cols-12 gap-2 px-3 py-3 text-xs"
              >
                <div className="col-span-3 self-center truncate text-white/85">
                  {nome}
                  {novo && (
                    <span className="ml-1.5 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                      novo
                    </span>
                  )}
                </div>
                <DeltaStack
                  className="col-span-3"
                  original={o.venda}
                  delta={a.venda}
                  efetivo={ef.venda}
                />
                <DeltaStack
                  className="col-span-3"
                  original={o.custo}
                  delta={a.custo}
                  efetivo={ef.custo}
                  invertido
                />
                <DeltaStack
                  className="col-span-3"
                  original={o.rav}
                  delta={a.rav}
                  efetivo={ef.rav}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * Célula compacta empilhada — três linhas com label à esquerda + valor
 * tabular à direita. Cabe em qualquer largura.
 *
 *   orig    R$ 1.200,00
 *   dif.    +R$ 100,00   (verde/vermelho conforme bom/ruim)
 *   efet.   R$ 1.300,00
 *
 * Sem o símbolo Δ pra evitar confusão — usa "dif." (diferença) como label.
 * Custo é `invertido`: subir é ruim (vermelho), descer é bom (verde).
 */
function DeltaStack({
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
    Math.abs(delta) < 0.01
      ? "text-white/30"
      : positivoBom
        ? "text-emerald-300"
        : "text-rose-300"

  return (
    <div className={cn("space-y-0.5 tabular-nums", className)}>
      <div className="flex items-baseline justify-between gap-1.5 text-[10px] text-white/40">
        <span>orig</span>
        <span>{formatBRL(original)}</span>
      </div>
      <div
        className={cn(
          "flex items-baseline justify-between gap-1.5 text-[10px] font-medium",
          deltaColor,
        )}
      >
        <span className="uppercase tracking-wider text-white/45">dif.</span>
        <span>
          {Math.abs(delta) < 0.01
            ? "—"
            : delta > 0
              ? `+${formatBRL(delta)}`
              : `-${formatBRL(Math.abs(delta))}`}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-1.5 text-[11px] font-semibold text-white">
        <span className="text-[10px] uppercase tracking-wider text-white/45">
          efet.
        </span>
        <span>{formatBRL(efetivo)}</span>
      </div>
    </div>
  )
}
