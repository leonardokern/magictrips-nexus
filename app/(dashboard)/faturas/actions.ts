"use server"

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
}

export async function getFaturas(): Promise<FaturaListItem[]> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from("faturas")
    .select(
      `
      id, numero_display, data_emissao, valor_total, status,
      cliente:clientes(nome),
      fatura_parcelas(parcela_id)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (!data) return []

  type Row = typeof data[number]
  type CliRel = { nome: string } | { nome: string }[] | null

  return data.map((row: Row) => {
    const cliRaw = row.cliente as CliRel
    const cli = Array.isArray(cliRaw) ? cliRaw[0] : cliRaw
    const fps = Array.isArray(row.fatura_parcelas)
      ? row.fatura_parcelas
      : row.fatura_parcelas ? [row.fatura_parcelas] : []

    return {
      id: row.id,
      numero_display: row.numero_display,
      data_emissao: row.data_emissao ?? "",
      valor_total: Number(row.valor_total ?? 0),
      status: row.status ?? "gerada",
      clienteNome: cli?.nome ?? "—",
      numeroParcelas: fps.length,
    }
  })
}
