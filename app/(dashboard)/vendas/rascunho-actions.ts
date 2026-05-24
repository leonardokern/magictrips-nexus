"use server"

import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"
import type { Json } from "@/types/database.types"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type RascunhoItem = {
  id: string
  titulo: string
  step: number
  empresa_id: string | null
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Lista os rascunhos do usuário logado (mais recentes primeiro). */
export async function listarRascunhos(): Promise<ActionResult<RascunhoItem[]>> {
  const user = await requireCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("vendas_rascunho")
    .select("id, titulo, step, empresa_id, updated_at")
    .eq("usuario_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

/**
 * Cria ou atualiza um rascunho.
 * - Se `rascunhoId` for null → INSERT (retorna o novo id)
 * - Se `rascunhoId` for uma string → UPDATE
 */
export async function salvarRascunho(
  rascunhoId: string | null,
  titulo: string,
  step: number,
  empresaId: string | null,
  dados: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  const supabase = await createClient()

  if (rascunhoId) {
    const { data, error } = await supabase
      .from("vendas_rascunho")
      .update({
        titulo,
        step,
        empresa_id: empresaId || null,
        dados: dados as unknown as Json,
      })
      .eq("id", rascunhoId)
      .eq("usuario_id", user.id)
      .select("id")
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { id: data.id } }
  }

  const { data, error } = await supabase
    .from("vendas_rascunho")
    .insert({
      usuario_id: user.id,
      titulo,
      step,
      empresa_id: empresaId || null,
      dados: dados as unknown as Json,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { id: data.id } }
}

/** Retorna os dados completos de um rascunho do usuário. */
export async function carregarRascunho(
  id: string,
): Promise<ActionResult<{ step: number; dados: Record<string, unknown> }>> {
  const user = await requireCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("vendas_rascunho")
    .select("step, dados")
    .eq("id", id)
    .eq("usuario_id", user.id)
    .single()

  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      step: data.step as number,
      dados: data.dados as Record<string, unknown>,
    },
  }
}

/** Remove um rascunho do usuário. */
export async function descartarRascunho(
  id: string,
): Promise<ActionResult<void>> {
  const user = await requireCurrentUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from("vendas_rascunho")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
