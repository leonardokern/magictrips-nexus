"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import {
  perfilCreateSchema,
  perfilUpdateSchema,
  sanitizarPermissoes,
  type PerfilComissaoOverride,
} from "@/lib/schemas/perfil"
import { permissoesTodas } from "@/lib/constants/permissoes"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

// Os perfis sistema agora são identificados pela coluna `chave_sistema`
// ('admin'|'gerente'|'agente') — o NOME pode ser renomeado livremente.
// Não há mais lista de nomes reservados: o UNIQUE em perfis_acesso(nome)
// + UNIQUE parcial em chave_sistema cuidam de colisão.

/**
 * Sincroniza os overrides de comissão de um perfil agente.
 * Substitui completamente o conjunto: apaga todos os overrides existentes e
 * insere os novos. O caller já filtrou pra mandar só overrides reais (valores
 * diferentes do default da empresa).
 */
async function syncComissoesOverrides(
  perfilId: string,
  overrides: PerfilComissaoOverride[],
) {
  const supabase = await createClient()
  await supabase.from("perfis_comissoes").delete().eq("perfil_id", perfilId)
  if (overrides.length === 0) return
  await supabase.from("perfis_comissoes").insert(
    overrides.map((o) => ({
      perfil_id: perfilId,
      origem_id: o.origem_id,
      percentual: o.percentual,
    })),
  )
}

export async function createPerfil(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "criar")) {
    return { ok: false, error: "Sem permissão para criar perfis." }
  }

  const parsed = perfilCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const { nome, tipo, empresa_id, permissoes, comissoes } = parsed.data
  const supabase = await createClient()

  const { data: novo, error } = await supabase
    .from("perfis_acesso")
    .insert({
      nome,
      tipo,
      empresa_id,
      sistema: false,
      ativo: true,
      permissoes: sanitizarPermissoes(permissoes),
    })
    .select("id")
    .single()

  if (error || !novo) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "Já existe um perfil com esse nome.",
        fieldErrors: { nome: "Nome já em uso." },
      }
    }
    return { ok: false, error: error?.message ?? "Falha ao criar perfil." }
  }

  // Salva overrides se for agente e admin tiver passado a lista
  if (tipo === "agente" && comissoes && comissoes.length > 0) {
    await syncComissoesOverrides(novo.id, comissoes)
  }

  await logAudit(user.id, "criar", novo.id, null, {
    nome,
    tipo,
    empresa_id,
    permissoes,
    sistema: false,
    comissoes_override_count: comissoes?.length ?? 0,
  })

  revalidatePath("/perfis")
  return { ok: true, data: { id: novo.id } }
}

export async function updatePerfil(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "editar")) {
    return { ok: false, error: "Sem permissão para editar perfis." }
  }

  const parsed = perfilUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: antes } = await (supabase as any)
    .from("perfis_acesso")
    .select("id, nome, sistema, permissoes, ativo, empresa_id, tipo, chave_sistema")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Perfil não encontrado." }

  const isAdmin = antes.chave_sistema === "admin"

  const updates: {
    nome?: string
    tipo?: "operacao" | "agente" | "marketing"
    empresa_id?: string | null
    permissoes?: Record<string, Record<string, boolean>>
  } = {}

  // Permissões e tipo do Admin são fixos (acesso total automático) — só nome muda.
  if (!isAdmin && parsed.data.permissoes !== undefined) {
    updates.permissoes = sanitizarPermissoes(parsed.data.permissoes)
  }
  // Só inclui nome/tipo/empresa no UPDATE se realmente mudaram, pra evitar
  // tropeço em triggers de reassignment idêntico (defesa em profundidade).
  if (
    parsed.data.nome !== undefined &&
    parsed.data.nome !== antes.nome
  ) {
    updates.nome = parsed.data.nome
  }
  if (
    !isAdmin &&
    parsed.data.tipo !== undefined &&
    parsed.data.tipo !== antes.tipo
  ) {
    updates.tipo = parsed.data.tipo
  }
  if (
    !isAdmin &&
    parsed.data.empresa_id !== undefined &&
    parsed.data.empresa_id !== antes.empresa_id
  ) {
    updates.empresa_id = parsed.data.empresa_id
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("perfis_acesso")
      .update(updates)
      .eq("id", id)
    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Já existe um perfil com esse nome.",
          fieldErrors: { nome: "Nome já em uso." },
        }
      }
      return { ok: false, error: error.message }
    }
  }

  // Comissões: só rola quando o perfil é (ou virou) agente.
  const tipoEfetivo = updates.tipo ?? antes.tipo
  if (parsed.data.comissoes !== undefined) {
    if (tipoEfetivo === "agente") {
      await syncComissoesOverrides(id, parsed.data.comissoes)
    } else {
      // Trocou pra operação → limpa overrides remanescentes
      await supabase.from("perfis_comissoes").delete().eq("perfil_id", id)
    }
  } else if (updates.tipo === "operacao") {
    // Sem comissoes no payload mas mudou pra operacao → limpa
    await supabase.from("perfis_comissoes").delete().eq("perfil_id", id)
  }

  await logAudit(user.id, "editar", id, antes, { ...antes, ...updates })

  revalidatePath("/perfis")
  revalidatePath(`/perfis/${id}`)
  return { ok: true }
}

export async function togglePerfilAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: antes } = await (supabase as any)
    .from("perfis_acesso")
    .select("id, nome, sistema, ativo, chave_sistema")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Perfil não encontrado." }
  if (antes.chave_sistema === "admin") {
    return { ok: false, error: "O perfil Administrador não pode ser desativado." }
  }

  // Inativar exige que não haja usuários atrelados. Reativar é sempre permitido.
  if (ativo === false) {
    const { count } = await supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("perfil_id", id)
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Existem ${count} usuário(s) neste perfil. Mude-os de perfil antes de inativar.`,
      }
    }
  }

  const { error } = await supabase
    .from("perfis_acesso")
    .update({ ativo })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }

  await logAudit(
    user.id,
    ativo ? "ativar" : "inativar",
    id,
    antes,
    { ...antes, ativo },
  )

  revalidatePath("/perfis")
  revalidatePath(`/perfis/${id}`)
  return { ok: true }
}

export async function deletePerfil(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "excluir")) {
    return { ok: false, error: "Sem permissão para excluir perfis." }
  }

  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("perfis_acesso")
    .select("id, nome, sistema, permissoes")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Perfil não encontrado." }

  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("perfil_id", id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Existem ${count} usuários neste perfil. Mude-os de perfil antes de excluir.`,
    }
  }

  const { error } = await supabase.from("perfis_acesso").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  await logAudit(user.id, "excluir", id, antes, null)

  revalidatePath("/perfis")
  return { ok: true }
}

export async function resetPermissoesAdmin() {
  const user = await requireCurrentUser()
  if (!can(user, "perfis", "editar")) {
    return { ok: false as const, error: "Sem permissão." }
  }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("perfis_acesso")
    .update({ permissoes: permissoesTodas(true) })
    .eq("chave_sistema", "admin")
  revalidatePath("/perfis")
  return { ok: true as const }
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
  acao: "criar" | "editar" | "excluir" | "ativar" | "inativar",
  entidadeId: string,
  antes: unknown,
  depois: unknown,
) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    usuario_id: usuarioId,
    empresa_id: null,
    acao,
    entidade: "perfil_acesso",
    entidade_id: entidadeId,
    dados_antes: antes as never,
    dados_depois: depois as never,
  })
}
