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

const PERFIL_ADMIN = "Administrador"
const NOMES_RESERVADOS = [
  "Administrador",
  "Gerente",
  "Agente",
  "Agente Magic Trips",
  "Agente Del Mondo",
]

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

  if (NOMES_RESERVADOS.map((n) => n.toLowerCase()).includes(nome.toLowerCase())) {
    return {
      ok: false,
      error: "Este nome é reservado para um perfil do sistema.",
      fieldErrors: { nome: "Nome reservado." },
    }
  }

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
  const { data: antes } = await supabase
    .from("perfis_acesso")
    .select("id, nome, sistema, permissoes, ativo, empresa_id, tipo")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Perfil não encontrado." }

  if (antes.nome === PERFIL_ADMIN) {
    return {
      ok: false,
      error:
        "O perfil Administrador tem acesso total automático e não é editável.",
    }
  }

  const updates: {
    nome?: string
    tipo?: "operacao" | "agente"
    empresa_id?: string | null
    permissoes?: Record<string, Record<string, boolean>>
  } = {}
  if (parsed.data.permissoes !== undefined) {
    updates.permissoes = sanitizarPermissoes(parsed.data.permissoes)
  }
  // Nome/tipo/empresa editáveis pra todos exceto Administrador (bloqueado acima).
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome
  if (parsed.data.tipo !== undefined) updates.tipo = parsed.data.tipo
  if (parsed.data.empresa_id !== undefined) {
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
  const { data: antes } = await supabase
    .from("perfis_acesso")
    .select("id, nome, sistema, ativo")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Perfil não encontrado." }
  if (antes.nome === PERFIL_ADMIN) {
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

  await logAudit(user.id, "editar", id, antes, { ...antes, ativo })

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
  await supabase
    .from("perfis_acesso")
    .update({ permissoes: permissoesTodas(true) })
    .eq("nome", PERFIL_ADMIN)
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
  acao: "criar" | "editar" | "excluir",
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
