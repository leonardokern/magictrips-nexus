"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

/**
 * Marca uma parcela como paga (ou desfaz, marcando como pendente). Aceita
 * dataPagamento opcional — quando ausente, usa hoje. Disponível pra
 * parcelas_receber e parcelas_pagar (escolhe a tabela via `tipo`).
 *
 * Restrito a usuários com `financeiro.editar`.
 */
export async function marcarParcelaPaga(args: {
  tipo: "receber" | "pagar"
  parcelaId: string
  dataPagamento?: string | null
  status: "pago" | "pendente"
}): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "editar")) {
    return { ok: false, error: "Sem permissão para alterar parcelas." }
  }

  const supabase = await createClient()
  const tabela = args.tipo === "receber" ? "parcelas_receber" : "parcelas_pagar"

  const dataPagamento =
    args.status === "pago"
      ? args.dataPagamento ?? new Date().toISOString().slice(0, 10)
      : null

  const { error } = await supabase
    .from(tabela)
    .update({ status: args.status, data_pagamento: dataPagamento })
    .eq("id", args.parcelaId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/financeiro/receber")
  revalidatePath("/financeiro/pagar")
  revalidatePath("/fluxo-de-caixa")
  revalidatePath("/dashboard")
  return { ok: true, data: undefined }
}
