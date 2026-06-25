"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import {
  cartaoCreateSchema,
  cartaoUpdateSchema,
} from "@/lib/schemas/cartao"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

function flatten(errors: Record<string, string[] | undefined>) {
  const out: Record<string, string> = {}
  for (const [k, msgs] of Object.entries(errors)) {
    if (msgs && msgs.length > 0 && msgs[0]) out[k] = msgs[0]
  }
  return out
}

export async function createCartao(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "criar")) {
    return { ok: false, error: "Sem permissão para criar cartões." }
  }

  const parsed = cartaoCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { data: novo, error } = await supabase
    .from("cartoes")
    .insert({
      nome: parsed.data.nome,
      banco: parsed.data.banco ?? null,
      empresa_id: parsed.data.empresa_id,
      usuario_id: parsed.data.usuario_id,
      dia_vencimento: parsed.data.dia_vencimento,
      dia_fechamento: parsed.data.dia_fechamento ?? null,
      ativo: true,
    })
    .select("id")
    .single()

  if (error || !novo) {
    return { ok: false, error: error?.message ?? "Falha ao criar cartão." }
  }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: parsed.data.empresa_id,
    acao: "criar",
    entidade: "cartao",
    entidade_id: novo.id,
    dados_depois: parsed.data,
  })

  revalidatePath("/cartoes")
  return { ok: true, data: { id: novo.id } }
}

export async function updateCartao(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const parsed = cartaoUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("cartoes")
    .select("id, nome, banco, empresa_id, usuario_id, dia_vencimento, dia_fechamento, ativo")
    .eq("id", id)
    .single()
  if (!antes) return { ok: false, error: "Cartão não encontrado." }

  const updates: {
    nome?: string
    banco?: string | null
    empresa_id?: string
    usuario_id?: string
    dia_vencimento?: number
    dia_fechamento?: number | null
    ativo?: boolean
  } = {}
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome
  if (parsed.data.banco !== undefined) updates.banco = parsed.data.banco
  if (parsed.data.empresa_id !== undefined) updates.empresa_id = parsed.data.empresa_id
  if (parsed.data.usuario_id !== undefined) updates.usuario_id = parsed.data.usuario_id
  if (parsed.data.dia_vencimento !== undefined) updates.dia_vencimento = parsed.data.dia_vencimento
  if (parsed.data.dia_fechamento !== undefined) updates.dia_fechamento = parsed.data.dia_fechamento
  if (parsed.data.ativo !== undefined) updates.ativo = parsed.data.ativo

  if (Object.keys(updates).length === 0) return { ok: true }

  const { error } = await supabase.from("cartoes").update(updates).eq("id", id)
  if (error) return { ok: false, error: error.message }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: updates.empresa_id ?? antes.empresa_id,
    acao: "editar",
    entidade: "cartao",
    entidade_id: id,
    dados_antes: antes,
    dados_depois: { ...antes, ...updates },
  })

  revalidatePath("/cartoes")
  return { ok: true }
}

export async function toggleCartaoAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }
  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("cartoes")
    .select("ativo, empresa_id")
    .eq("id", id)
    .single()
  if (!antes) return { ok: false, error: "Cartão não encontrado." }

  const { error } = await supabase.from("cartoes").update({ ativo }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: antes.empresa_id,
    acao: ativo ? "ativar" : "inativar",
    entidade: "cartao",
    entidade_id: id,
    dados_antes: { ativo: antes.ativo },
    dados_depois: { ativo },
  })

  revalidatePath("/cartoes")
  return { ok: true }
}

// ── Caixas ────────────────────────────────────────────────────────────────────

export type CaixaItem = { id: string; nome: string; ativo: boolean }

export async function getCaixas(): Promise<CaixaItem[]> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "ler")) return []
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("caixas").select("id, nome, ativo")
    .order("ativo", { ascending: false }).order("nome")
  return (data ?? []) as CaixaItem[]
}

export async function criarCaixa(nome: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "editar")) return { ok: false, error: "Sem permissão." }
  if (!nome.trim()) return { ok: false, error: "Nome obrigatório." }
  const supabase = await createClient()
  const { data: ue } = await supabase
    .from("usuarios_empresas").select("empresa_id").eq("usuario_id", user.id).limit(1).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("caixas").insert({ nome: nome.trim(), empresa_id: ue?.empresa_id ?? null })
  if (error) return { ok: false, error: (error as { message: string }).message }
  revalidatePath("/cartoes")
  return { ok: true }
}

export async function editarCaixa(id: string, nome: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "editar")) return { ok: false, error: "Sem permissão." }
  if (!nome.trim()) return { ok: false, error: "Nome obrigatório." }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("caixas").update({ nome: nome.trim() }).eq("id", id)
  if (error) return { ok: false, error: (error as { message: string }).message }
  revalidatePath("/cartoes")
  return { ok: true }
}

export async function toggleCaixaAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "editar")) return { ok: false, error: "Sem permissão." }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("caixas").update({ ativo }).eq("id", id)
  if (error) return { ok: false, error: (error as { message: string }).message }
  revalidatePath("/cartoes")
  return { ok: true }
}

// ── Cartões ───────────────────────────────────────────────────────────────────

export async function deleteCartao(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "cartoes", "excluir")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  // Bloqueia se cartão tiver pagamentos vinculados
  const [{ count: pagar }, { count: vendaProdutos }] = await Promise.all([
    supabase
      .from("parcelas_pagar")
      .select("id", { count: "exact", head: true })
      .eq("cartao_id", id),
    supabase
      .from("venda_produtos")
      .select("id", { count: "exact", head: true })
      .eq("pgto_cartao_id", id),
  ])
  const uso = (pagar ?? 0) + (vendaProdutos ?? 0)
  if (uso > 0) {
    return {
      ok: false,
      error: `Este cartão está em uso (${uso} registro(s)). Inative em vez de excluir.`,
    }
  }

  const { error } = await supabase.from("cartoes").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/cartoes")
  return { ok: true }
}
