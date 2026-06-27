/**
 * Desfluxo de caixa — quando a agência adianta dinheiro pra fornecedor
 * com prazo maior do que o recebimento do cliente, esse "tempo de capital
 * de giro" é precificado e descontado do RAV.
 *
 * Regra: a partir do mês 2 de diferença, 1,5% por mês.
 *   diff = 1 mês → 0% (sem desfluxo)
 *   diff = 2 → 3,0%
 *   diff = 3 → 4,5%
 *   diff = N → N × 1,5%
 *
 * O valor base do custo NÃO muda — o desfluxo é só sobreposição contábil
 * pra ajustar RAV e comissão. parcelas_pagar continuam pelo custo real.
 */

export const DESFLUXO_PERCENTUAL_POR_MES = 1.5

/**
 * pgto_forma que a agência efetivamente fronta (paga ao fornecedor).
 * `cartao_cliente` não conta — cliente paga direto, sem antecipação.
 */
const PGTO_FORMAS_QUE_FRONTAM = new Set(["cartao_agencia", "faturado"])

export function calcularDesfluxo(input: {
  produtos: Array<{
    pgto_forma: string | null
    pgto_num_parcelas: number | null
    /** Pra pgto_forma='faturado', o nº de parcelas vem do array.
     *  Outros tipos usam pgto_num_parcelas. */
    pgto_parcelas_detalhe?: unknown[] | null
  }>
  cobrancas: Array<{ num_parcelas: number | null }>
}): { meses: number; percentual: number } {
  const parcelasCusto = input.produtos
    .filter((p) => p.pgto_forma && PGTO_FORMAS_QUE_FRONTAM.has(p.pgto_forma))
    .map((p) => {
      if (
        p.pgto_forma === "faturado" &&
        Array.isArray(p.pgto_parcelas_detalhe) &&
        p.pgto_parcelas_detalhe.length > 0
      ) {
        return p.pgto_parcelas_detalhe.length
      }
      return p.pgto_num_parcelas ?? 1
    })

  // Se a agência NÃO fronta nada (ex: venda 100% cartao_cliente), não há
  // capital de giro adiantado pra precificar — desfluxo é 0 por definição.
  if (parcelasCusto.length === 0) return { meses: 0, percentual: 0 }

  const maxCusto = Math.max(...parcelasCusto)
  const parcelasCobr = input.cobrancas.map((c) => c.num_parcelas ?? 1)
  const maxCobr = parcelasCobr.length > 0 ? Math.max(...parcelasCobr) : 1

  const diff = Math.max(0, maxCobr - maxCusto)
  const percentual = diff >= 2 ? diff * DESFLUXO_PERCENTUAL_POR_MES : 0
  return { meses: diff, percentual }
}

/**
 * Custo efetivo da venda quando desfluxo está aplicado.
 * Ex: custo R$ 1.000, % 4.5 → R$ 1.045.
 */
export function aplicarDesfluxoNoCusto(
  custoBase: number,
  percentual: number,
): number {
  return Number((custoBase * (1 + percentual / 100)).toFixed(2))
}
