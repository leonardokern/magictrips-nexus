"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"

export type FaturaListItem = {
  id: string
  numero_display: string
  data_emissao: string
  valor_total: number
  status: string
  clienteNome: string
  numeroParcelas: number
  caixaNome: string | null
  dataPagamento: string | null
}

export async function getFaturas(): Promise<FaturaListItem[]> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) return []

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("faturas")
    .select(
      `id, numero_display, data_emissao, valor_total, status, data_pagamento,
      cliente:clientes(nome),
      caixa:caixas(nome),
      fatura_parcelas(parcela_id)`,
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (!data) return []

  type Row = {
    id: string
    numero_display: string
    data_emissao: string | null
    valor_total: number | null
    status: string | null
    data_pagamento: string | null
    cliente: { nome: string } | { nome: string }[] | null
    caixa: { nome: string } | { nome: string }[] | null
    fatura_parcelas: { parcela_id: string }[] | null
  }

  return (data as Row[]).map((row) => {
    const cliRaw = row.cliente
    const cli = Array.isArray(cliRaw) ? cliRaw[0] : cliRaw
    const caixaRaw = row.caixa
    const caixaObj = Array.isArray(caixaRaw) ? caixaRaw[0] : caixaRaw
    const fps = row.fatura_parcelas ?? []

    return {
      id: row.id,
      numero_display: row.numero_display,
      data_emissao: row.data_emissao ?? "",
      valor_total: Number(row.valor_total ?? 0),
      status: row.status ?? "gerada",
      clienteNome: cli?.nome ?? "—",
      numeroParcelas: fps.length,
      caixaNome: caixaObj?.nome ?? null,
      dataPagamento: row.data_pagamento ?? null,
    }
  })
}

export async function marcarFaturaPaga(args: {
  faturaId: string
  caixaId: string
  dataPagamento: string
  valorRecebido: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "editar")) return { ok: false, error: "Sem permissão." }

  const supabase = await createClient()

  // Busca as parcelas da fatura
  const { data: fps } = await supabase
    .from("fatura_parcelas")
    .select("parcela_id, parcela:parcelas_receber(data_vencimento)")
    .eq("fatura_id", args.faturaId)

  if (!fps || fps.length === 0) return { ok: false, error: "Fatura não encontrada ou sem parcelas." }

  // Determina status de cada parcela (pago vs pago_atraso)
  const updates = (fps as unknown as Array<{
    parcela_id: string
    parcela: { data_vencimento: string } | { data_vencimento: string }[] | null
  }>).map((fp) => {
    const parcela = fp.parcela
      ? Array.isArray(fp.parcela) ? fp.parcela[0] : fp.parcela
      : null
    const venc = parcela?.data_vencimento ?? "9999-12-31"
    const statusParcela = args.dataPagamento > venc ? "pago_atraso" : "pago"
    return { id: fp.parcela_id, status: statusParcela }
  })

  // Atualiza cada parcela (caixa_id/data_pagamento são colunas novas, cast necessário)
  for (const u of updates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("parcelas_receber")
      .update({ status: u.status, data_pagamento: args.dataPagamento, caixa_id: args.caixaId })
      .eq("id", u.id)
    if (error) return { ok: false, error: (error as { message: string }).message }
  }

  // Atualiza a fatura (colunas novas, cast necessário)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: fatErr } = await (supabase as any)
    .from("faturas")
    .update({
      status: "paga",
      caixa_id: args.caixaId,
      data_pagamento: args.dataPagamento,
      valor_recebido: args.valorRecebido,
    })
    .eq("id", args.faturaId)

  if (fatErr) return { ok: false, error: (fatErr as { message: string }).message }

  revalidatePath("/faturas")
  revalidatePath("/financeiro/receber")
  return { ok: true }
}
