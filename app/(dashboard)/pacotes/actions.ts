"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { pacoteSchema } from "@/lib/schemas/pacote"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

/**
 * Cria pacote (template de venda reutilizável).
 * RPC criar_pacote é SECURITY DEFINER — insere pacote + itens + fornecedores
 * de itens numa única chamada. Autorização real checada aqui via can().
 */
export async function createPacote(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "pacotes", "criar")) {
    return { ok: false, error: "Sem permissão para criar pacotes." }
  }

  const parsed = pacoteSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const values = parsed.data
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: novoId, error } = await (supabase as any).rpc("criar_pacote", {
    p_empresa_id:         values.empresa_id,
    p_nome:               values.nome,
    p_descricao:          values.descricao || null,
    p_tipo_pacote:        values.tipo_pacote,
    p_data_inicio_viagem: values.data_inicio_viagem,
    p_data_fim_viagem:    values.data_fim_viagem,
    p_tipo_produto_id:    values.tipo_produto_id || null,
    p_fornecedor_id:      values.fornecedor_id || null,
    p_valor_custo_total:  values.valor_custo_total ?? null,
    p_valores_extras:     values.valores_extras,
    p_itens:              itensParaRpc(values.itens),
    p_created_by:         user.id,
  })

  if (error) {
    return { ok: false, error: (error as { message: string }).message ?? "Falha ao salvar pacote." }
  }

  const id = novoId as string
  await logAudit(user.id, values.empresa_id, "criar", id, null, values)

  revalidatePath("/pacotes")
  return { ok: true, data: { id } }
}

export async function updatePacote(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "pacotes", "editar")) {
    return { ok: false, error: "Sem permissão para editar pacotes." }
  }

  const parsed = pacoteSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const values = parsed.data
  const supabase = await createClient()

  const { data: antes } = await supabase
    .from("pacotes")
    .select("*")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Pacote não encontrado." }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("atualizar_pacote", {
    p_id:                 id,
    p_nome:               values.nome,
    p_descricao:          values.descricao || null,
    p_tipo_pacote:        values.tipo_pacote,
    p_data_inicio_viagem: values.data_inicio_viagem,
    p_data_fim_viagem:    values.data_fim_viagem,
    p_tipo_produto_id:    values.tipo_produto_id || null,
    p_fornecedor_id:      values.fornecedor_id || null,
    p_valor_custo_total:  values.valor_custo_total ?? null,
    p_valores_extras:     values.valores_extras,
    p_itens:              itensParaRpc(values.itens),
  })

  if (error) return { ok: false, error: (error as { message: string }).message }

  await logAudit(user.id, values.empresa_id, "editar", id, antes, values)

  revalidatePath("/pacotes")
  return { ok: true }
}

export async function togglePacoteAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "pacotes", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("pacotes")
    .select("ativo, empresa_id")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Pacote não encontrado." }

  const { error } = await supabase
    .from("pacotes")
    .update({ ativo })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }

  await logAudit(
    user.id,
    antes.empresa_id,
    ativo ? "ativar" : "inativar",
    id,
    { ativo: antes.ativo },
    { ativo },
  )

  revalidatePath("/pacotes")
  return { ok: true }
}

export async function deletePacote(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "pacotes", "excluir")) {
    return { ok: false, error: "Sem permissão para excluir pacotes." }
  }

  const supabase = await createClient()

  // Bloqueia exclusão se houver venda_produtos originados deste pacote
  const { count } = await supabase
    .from("venda_produtos")
    .select("id", { count: "exact", head: true })
    .eq("origem_pacote_id", id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "Este pacote possui vendas registradas. Inative-o em vez disso.",
    }
  }

  const { data: antes } = await supabase
    .from("pacotes")
    .select("*")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Pacote não encontrado." }

  const { error } = await supabase.from("pacotes").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  await logAudit(user.id, antes.empresa_id, "excluir", id, antes, null)

  revalidatePath("/pacotes")
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type PacoteItemInputLike = {
  ordem: number
  tipo_produto_id: string
  descricao?: string | null
  valores_extras: Record<string, string>
  fornecedores: {
    fornecedor_id: string
    valor_custo: number
    ordem: number
  }[]
}

/** Monta o jsonb array `p_itens` no formato esperado pelas RPCs criar/atualizar_pacote. */
function itensParaRpc(itens: PacoteItemInputLike[]) {
  return itens.map((i) => ({
    ordem: i.ordem,
    tipo_produto_id: i.tipo_produto_id,
    descricao: i.descricao || null,
    valores_extras: i.valores_extras,
    fornecedores: i.fornecedores.map((f) => ({
      fornecedor_id: f.fornecedor_id,
      valor_custo: f.valor_custo,
      ordem: f.ordem,
    })),
  }))
}

function flattenFieldErrors(
  errors: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, msgs] of Object.entries(errors)) {
    if (msgs && msgs.length > 0 && msgs[0]) out[k] = msgs[0]
  }
  return out
}

async function logAudit(
  usuarioId: string,
  empresaId: string | null,
  acao: "criar" | "editar" | "excluir" | "ativar" | "inativar",
  entidadeId: string,
  antes: unknown,
  depois: unknown,
) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    usuario_id: usuarioId,
    empresa_id: empresaId,
    acao,
    entidade: "pacote",
    entidade_id: entidadeId,
    dados_antes: antes as never,
    dados_depois: depois as never,
  })
}
