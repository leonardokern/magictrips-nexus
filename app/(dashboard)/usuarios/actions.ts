"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import {
  alterarSenhaSchema,
  usuarioCreateSchema,
  usuarioUpdateSchema,
} from "@/lib/schemas/usuario"
import { derivarIniciais, gerarSenhaProvisoria } from "@/lib/utils/password"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"
import type { TablesUpdate } from "@/types/database.types"

/**
 * Cria um novo usuário (apenas Administrador).
 * Gera uma senha provisória e a retorna pra exibição no admin.
 * A senha NÃO é persistida em plain-text em lugar nenhum.
 */
export async function createUsuario(
  raw: unknown,
): Promise<ActionResult<{ id: string; senhaProvisoria: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "criar")) {
    return { ok: false, error: "Apenas o Administrador pode criar usuários." }
  }

  const parsed = usuarioCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const values = parsed.data
  const senhaProvisoria = gerarSenhaProvisoria(12)
  const iniciais = values.iniciais?.trim() || derivarIniciais(values.nome)

  const supabase = await createClient()
  // Cast pra contornar limitação dos types gerados: a função aceita NULL em
  // p_empresa_id (Administrador), mas a tipagem inferida espera string.
  const { data, error } = await supabase.rpc("criar_usuario_admin", {
    p_email: values.email,
    p_senha: senhaProvisoria,
    p_nome: values.nome,
    p_perfil_id: values.perfil_id,
    p_empresa_id: values.empresa_id as string,
    p_iniciais: iniciais,
    p_comissao_percentual: values.comissao_percentual ?? undefined,
  })

  if (error) {
    return { ok: false, error: traduzirErroRpc(error.message) }
  }

  revalidatePath("/usuarios")
  return {
    ok: true,
    data: { id: data as string, senhaProvisoria },
  }
}

/**
 * Atualiza dados do usuário (perfil, empresa, nome, iniciais, comissão).
 * Não toca em e-mail (auth.users.email exige fluxo especial) nem senha (use resetSenha).
 */
export async function updateUsuario(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "editar")) {
    return { ok: false, error: "Sem permissão para editar usuários." }
  }

  const parsed = usuarioUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const v = parsed.data
  const supabase = await createClient()

  // Snapshot pra audit
  const { data: antes } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Usuário não encontrado." }

  // Se mudar perfil, validar coerência empresa_id
  if (v.perfil_id) {
    const { data: perfil } = await supabase
      .from("perfis_acesso")
      .select("nome")
      .eq("id", v.perfil_id)
      .single()
    if (!perfil) return { ok: false, error: "Perfil inválido." }
    if (perfil.nome !== "Administrador" && v.empresa_id === null) {
      return {
        ok: false,
        error: "Apenas o Administrador pode ter empresa em branco.",
        fieldErrors: { empresa_id: "Selecione uma empresa." },
      }
    }
  }

  const updates: TablesUpdate<"usuarios"> = {}
  if (v.nome !== undefined) updates.nome = v.nome
  if (v.perfil_id !== undefined) updates.perfil_id = v.perfil_id
  if (v.empresa_id !== undefined) updates.empresa_id = v.empresa_id
  if (v.iniciais !== undefined) {
    updates.iniciais = v.iniciais?.trim() || derivarIniciais(v.nome ?? antes.nome)
  }
  if (v.comissao_percentual !== undefined) {
    updates.comissao_percentual = v.comissao_percentual
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "Nada a atualizar." }
  }

  const { error } = await supabase.from("usuarios").update(updates).eq("id", id)
  if (error) return { ok: false, error: error.message }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: antes.empresa_id,
    acao: "editar",
    entidade: "usuario",
    entidade_id: id,
    dados_antes: antes as never,
    dados_depois: { ...antes, ...updates } as never,
  })

  revalidatePath("/usuarios")
  revalidatePath(`/usuarios/${id}`)
  return { ok: true }
}

/**
 * Ativa/desativa usuário. Não exclui — preserva histórico.
 * Usuário desativado é bloqueado no login pelo middleware.
 */
export async function toggleUsuarioAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  // Não permite desativar a si mesmo
  if (id === user.id && !ativo) {
    return {
      ok: false,
      error: "Você não pode desativar o próprio usuário.",
    }
  }

  const supabase = await createClient()
  const { data: antes } = await supabase
    .from("usuarios")
    .select("ativo, empresa_id")
    .eq("id", id)
    .single()

  if (!antes) return { ok: false, error: "Usuário não encontrado." }

  const { error } = await supabase
    .from("usuarios")
    .update({ ativo })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: antes.empresa_id,
    acao: "editar",
    entidade: "usuario",
    entidade_id: id,
    dados_antes: { ativo: antes.ativo } as never,
    dados_depois: { ativo } as never,
  })

  revalidatePath("/usuarios")
  revalidatePath(`/usuarios/${id}`)
  return { ok: true }
}

/**
 * Reseta a senha de outro usuário. Apenas Administrador.
 * Gera nova senha, retorna pra exibição. Marca force_password_change=true.
 */
export async function resetarSenha(
  id: string,
): Promise<ActionResult<{ senhaProvisoria: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "editar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const novaSenha = gerarSenhaProvisoria(12)
  const supabase = await createClient()
  const { error } = await supabase.rpc("resetar_senha_usuario", {
    p_user_id: id,
    p_nova_senha: novaSenha,
  })

  if (error) return { ok: false, error: traduzirErroRpc(error.message) }

  revalidatePath(`/usuarios/${id}`)
  return { ok: true, data: { senhaProvisoria: novaSenha } }
}

/**
 * Exclui usuário (apenas Administrador, sem vendas associadas).
 */
export async function deleteUsuario(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "excluir")) {
    return { ok: false, error: "Apenas o Administrador pode excluir usuários." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("excluir_usuario_admin", {
    p_user_id: id,
  })

  if (error) return { ok: false, error: traduzirErroRpc(error.message) }

  revalidatePath("/usuarios")
  redirect("/usuarios")
}

/**
 * Usuário autenticado troca a própria senha.
 * Limpa force_password_change ao final.
 */
export async function alterarMinhaSenha(raw: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()

  const parsed = alterarSenhaSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("alterar_minha_senha", {
    p_senha_atual: parsed.data.senha_atual,
    p_nova_senha: parsed.data.nova_senha,
  })

  if (error) return { ok: false, error: traduzirErroRpc(error.message) }

  // Toca rotas que dependem do force_password_change
  revalidatePath("/", "layout")
  return { ok: true, data: undefined as unknown as void }
  // (caller deve redirect manual após sucesso — Server Action de form usa router.push)
  void user
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

function traduzirErroRpc(msg: string): string {
  // Mapeia mensagens conhecidas das RPCs em PT-BR pra UX melhor
  const m = msg.toLowerCase()
  if (m.includes("já existe um usuário")) {
    return "Já existe um usuário com este e-mail."
  }
  if (m.includes("apenas o administrador")) {
    return "Apenas o Administrador pode executar esta ação."
  }
  if (m.includes("senha atual incorreta")) {
    return "Senha atual incorreta."
  }
  if (m.includes("nova senha")) {
    return msg
  }
  if (m.includes("vendas registradas")) {
    return "Este usuário possui vendas registradas. Inative-o em vez disso."
  }
  return msg || "Erro inesperado."
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
