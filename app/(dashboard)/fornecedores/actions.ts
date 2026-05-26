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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertResult = await (supabase as any)
    .from("fornecedores")
    .insert({
      nome: values.nome,
      cnpj: values.cnpj,
      tipo: values.tipo || null,
      ativo: true,
      modo_comissionado: values.modo_comissionado,
      modo_comissionado_dia_pagamento: values.modo_comissionado
        ? (values.modo_comissionado_dia_pagamento ?? null)
        : null,
      modo_net: values.modo_net,
    })
    .select("id")
    .single()
  const novo = insertResult.data as { id: string } | null
  const error = insertResult.error as { message: string } | null

  if (error || !novo) {
    return { ok: false, error: error?.message ?? "Falha ao salvar fornecedor." }
  }

  // Vincula tipos de produto (tabela nova — cast necessário até regenerar database.types.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  if (values.tipos_produto_ids.length > 0) {
    await db.from("fornecedor_tipos_produto").insert(
      values.tipos_produto_ids.map((tp_id: string) => ({
        fornecedor_id: novo.id,
        tipo_produto_id: tp_id,
      })),
    )
  }

  await logAudit(user.id, user.empresas[0]?.id ?? null, "criar", novo.id, null, values)

  revalidatePath("/fornecedores")
  return { ok: true, data: { id: novo.id } }
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
    .select("*")
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateResult = await (supabase as any)
    .from("fornecedores")
    .update({
      nome: values.nome,
      cnpj: values.cnpj,
      tipo: values.tipo || null,
      modo_comissionado: values.modo_comissionado,
      modo_comissionado_dia_pagamento: values.modo_comissionado
        ? (values.modo_comissionado_dia_pagamento ?? null)
        : null,
      modo_net: values.modo_net,
    })
    .eq("id", id)
  const error = updateResult.error as { message: string } | null

  if (error) return { ok: false, error: error.message }

  // Substitui vínculos de tipos de produto (delete + insert)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  await db.from("fornecedor_tipos_produto").delete().eq("fornecedor_id", id)
  if (values.tipos_produto_ids.length > 0) {
    await db.from("fornecedor_tipos_produto").insert(
      values.tipos_produto_ids.map((tp_id: string) => ({
        fornecedor_id: id,
        tipo_produto_id: tp_id,
      })),
    )
  }

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
