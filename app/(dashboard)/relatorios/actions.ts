"use server"

import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import {
  buildRelatorioTipoProduto,
  type RelatorioTipoProdutoFiltros,
  type RelatorioTipoProdutoDados,
} from "@/lib/relatorios/tipo-produto"
import {
  buildRelatorioComissao,
  type RelatorioComissaoFiltros,
  type RelatorioComissaoDados,
} from "@/lib/relatorios/comissao"

const ISO = /^\d{4}-\d{2}-\d{2}$/

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string }

/** Prévia on-screen do relatório de vendas por tipo de produto. */
export async function previewTipoProduto(
  f: RelatorioTipoProdutoFiltros,
): Promise<Resultado<RelatorioTipoProdutoDados>> {
  const user = await requireCurrentUser()
  if (!can(user, "relatorios", "ver")) {
    return { ok: false, error: "Sem permissão para gerar relatórios." }
  }
  if (!f.tipoProdutoId) return { ok: false, error: "Selecione um tipo de produto." }
  if (!ISO.test(f.dataInicio) || !ISO.test(f.dataFim)) {
    return { ok: false, error: "Informe um intervalo de datas válido." }
  }
  if (f.dataInicio > f.dataFim) {
    return { ok: false, error: "A data inicial não pode ser maior que a final." }
  }
  const supabase = await createClient()
  return buildRelatorioTipoProduto(supabase, f)
}

/** Prévia on-screen do relatório de comissão por agente. */
export async function previewComissao(
  f: RelatorioComissaoFiltros,
): Promise<Resultado<RelatorioComissaoDados>> {
  const user = await requireCurrentUser()
  if (!can(user, "relatorios", "ver")) {
    return { ok: false, error: "Sem permissão para gerar relatórios." }
  }
  if (!ISO.test(f.dataInicio) || !ISO.test(f.dataFim)) {
    return { ok: false, error: "Informe um intervalo de datas válido." }
  }
  if (f.dataInicio > f.dataFim) {
    return { ok: false, error: "A data inicial não pode ser maior que a final." }
  }
  const supabase = await createClient()
  return buildRelatorioComissao(supabase, f)
}
