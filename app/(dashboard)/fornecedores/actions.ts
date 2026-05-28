"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { fornecedorSchema } from "@/lib/schemas/fornecedor"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

/**
 * Cria fornecedor. Apenas Administrador pela UI dedicada.
 * (O fluxo "Outros" da venda no futuro usará outra action — agente pode criar
 * inline porque a RLS de fornecedores permite INSERT por authenticated.)
 */
export async function createFornecedor(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "fornecedores", "criar")) {
    return { ok: false, error: "Sem permissão para criar fornecedores." }
  }

  const parsed = fornecedorSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const values = parsed.data
  const supabase = await createClient()

  // Dedup CNPJ (UNIQUE garante no banco, mas UX melhor com erro claro)
  const { data: existente } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("cnpj", values.cnpj)
    .maybeSingle()

  if (existente) {
    return {
      ok: false,
      error: `Já existe um fornecedor com este CNPJ: ${existente.nome}.`,
      fieldErrors: { cnpj: "CNPJ já cadastrado." },
    }
  }

  // RPC com SECURITY DEFINER — bypassa RLS em fornecedores + fornecedor_tipos_produto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: novoId, error } = await (supabase as any).rpc("criar_fornecedor", {
    p_nome:                 values.nome,
    p_cnpj:                 values.cnpj,
    p_tipo:                 values.tipo || null,
    p_modo_comissionado:    values.modo_comissionado,
    p_modo_comissionado_dia: values.modo_comissionado
      ? (values.modo_comissionado_dia_pagamento ?? null)
      : null,
    p_modo_net:             values.modo_net,
    p_tipos_produto_ids:    values.tipos_produto_ids,
  })

  if (error) {
    return { ok: false, error: (error as { message: string }).message ?? "Falha ao salvar fornecedor." }
  }

  const id = novoId as string
  await logAudit(user.id, user.empresas[0]?.id ?? null, "criar", id, null, values)

  revalidatePath("/fornecedores")
  return { ok: true, data: { id } }
}

export async function updateFornecedor(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "fornecedores", "editar")) {
    return { ok: false, error: "Sem permissão para editar fornecedores." }
  }

  const parsed = fornecedorSchema.safeParse(raw)
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
    .from("fornecedores")
    .select("id, nome, cnpj")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Fornecedor não encontrado." }

  // Dedup CNPJ ignorando o próprio id
  if (values.cnpj !== antes.cnpj) {
    const { data: dup } = await supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("cnpj", values.cnpj)
      .neq("id", id)
      .maybeSingle()
    if (dup) {
      return {
        ok: false,
        error: `Já existe um fornecedor com este CNPJ: ${dup.nome}.`,
        fieldErrors: { cnpj: "CNPJ já cadastrado." },
      }
    }
  }

  // RPC com SECURITY DEFINER — bypassa RLS em fornecedores + fornecedor_tipos_produto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("atualizar_fornecedor", {
    p_id:                   id,
    p_nome:                 values.nome,
    p_cnpj:                 values.cnpj,
    p_tipo:                 values.tipo || null,
    p_modo_comissionado:    values.modo_comissionado,
    p_modo_comissionado_dia: values.modo_comissionado
      ? (values.modo_comissionado_dia_pagamento ?? null)
      : null,
    p_modo_net:             values.modo_net,
    p_tipos_produto_ids:    values.tipos_produto_ids,
  })

  if (error) return { ok: false, error: (error as { message: string }).message }

  await logAudit(user.id, user.empresas[0]?.id ?? null, "editar", id, antes, values)

  revalidatePath("/fornecedores")
  revalidatePath(`/fornecedores/${id}`)
  return { ok: true }
}

export async function toggleFornecedorAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "fornecedores", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("fornecedores")
    .select("ativo")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Fornecedor não encontrado." }

  const { error } = await supabase
    .from("fornecedores")
    .update({ ativo })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }

  await logAudit(
    user.id,
    user.empresas[0]?.id ?? null,
    "editar",
    id,
    { ativo: antes.ativo },
    { ativo },
  )

  revalidatePath("/fornecedores")
  revalidatePath(`/fornecedores/${id}`)
  return { ok: true }
}

export async function deleteFornecedor(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "fornecedores", "excluir")) {
    return { ok: false, error: "Sem permissão para excluir fornecedores." }
  }

  const supabase = await createClient()

  // Bloqueia exclusão se houver venda_produtos referenciando
  const { count } = await supabase
    .from("venda_produtos")
    .select("id", { count: "exact", head: true })
    .eq("fornecedor_id", id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Este fornecedor possui vendas registradas. Inative-o em vez disso.",
    }
  }

  const { data: antes } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Fornecedor não encontrado." }

  const { error } = await supabase.from("fornecedores").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  await logAudit(user.id, user.empresas[0]?.id ?? null, "excluir", id, antes, null)

  revalidatePath("/fornecedores")
  redirect("/fornecedores")
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  acao: "criar" | "editar" | "excluir",
  entidadeId: string,
  antes: unknown,
  depois: unknown,
) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    usuario_id: usuarioId,
    empresa_id: empresaId,
    acao,
    entidade: "fornecedor",
    entidade_id: entidadeId,
    dados_antes: antes as never,
    dados_depois: depois as never,
  })
}
