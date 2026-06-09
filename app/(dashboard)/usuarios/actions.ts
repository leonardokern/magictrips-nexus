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
import {
  enviarEmailNovoUsuarioComSenhaProvisoria,
  enviarEmailNovoUsuarioSenhaDefinitiva,
} from "@/lib/email/send"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"
import type { TablesUpdate } from "@/types/database.types"

/**
 * Cria um novo usuário (apenas Administrador).
 * Admin define a senha + decide se o usuário precisa trocá-la no primeiro
 * acesso. A senha NÃO é persistida em plain-text — só vai pro auth.users
 * já com hash bcrypt.
 */
export async function createUsuario(
  raw: unknown,
): Promise<
  ActionResult<{
    id: string
    senhaDefinida: string
    forcouTroca: boolean
    emailEnviado: boolean
    emailErro?: string
  }>
> {
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
  const iniciais = derivarIniciais(values.nome)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("criar_usuario_admin", {
    p_email: values.email,
    p_senha: values.senha,
    p_nome: values.nome,
    p_perfil_id: values.perfil_id,
    p_empresa_ids: values.empresa_ids,
    p_iniciais: iniciais,
    p_forcar_troca: values.forcar_troca_senha,
  })

  if (error) {
    return { ok: false, error: traduzirErroRpc(error.message) }
  }

  // ── Email de boas-vindas (best-effort) ──────────────────────────────────
  // Falha de envio NÃO bloqueia a criação. A senha continua disponível pro
  // admin via SenhaProvisoriaDialog mesmo que o email falhe.
  const r = values.forcar_troca_senha
    ? await enviarEmailNovoUsuarioComSenhaProvisoria({
        to: values.email,
        nome: values.nome,
        senhaProvisoria: values.senha,
        criadoPor: user.nome,
      })
    : await enviarEmailNovoUsuarioSenhaDefinitiva({
        to: values.email,
        nome: values.nome,
        criadoPor: user.nome,
      })

  revalidatePath("/usuarios")
  return {
    ok: true,
    data: {
      id: data as string,
      senhaDefinida: values.senha,
      forcouTroca: values.forcar_troca_senha,
      emailEnviado: r.ok,
      emailErro: r.ok ? undefined : r.reason === "disabled"
        ? "Envio de e-mail desativado (RESEND_API_KEY não configurada)."
        : r.error ?? "Falha desconhecida ao enviar e-mail.",
    },
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

  // Empresas precisam de pelo menos 1
  if (v.empresa_ids !== undefined && v.empresa_ids.length === 0) {
    return {
      ok: false,
      error: "Selecione ao menos uma empresa.",
      fieldErrors: { empresa_ids: "Selecione ao menos uma empresa." },
    }
  }

  // Update dos campos da tabela usuarios (nome, perfil, iniciais)
  const updates: TablesUpdate<"usuarios"> = {}
  if (v.nome !== undefined) updates.nome = v.nome
  if (v.perfil_id !== undefined) updates.perfil_id = v.perfil_id
  if (v.nome !== undefined) {
    updates.iniciais = derivarIniciais(v.nome ?? antes.nome)
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("usuarios")
      .update(updates)
      .eq("id", id)
    if (error) return { ok: false, error: error.message }
  }

  // Update das empresas via RPC (replace completo).
  // A RPC `atualizar_empresas_usuario` aceita Admin OR Gerente (migration 060).
  // O gate aqui é apenas semântico: só faz sentido enviar empresa_ids quando
  // o usuário corrente tem privilégio de gestão de identidade.
  if (
    v.empresa_ids !== undefined &&
    (user.perfil.chave_sistema === "admin" ||
      user.perfil.chave_sistema === "gerente")
  ) {
    const { error: empErr } = await supabase.rpc("atualizar_empresas_usuario", {
      p_user_id: id,
      p_empresa_ids: v.empresa_ids,
    })
    if (empErr) return { ok: false, error: traduzirErroRpc(empErr.message) }
  }

  await supabase.from("audit_logs").insert({
    usuario_id: user.id,
    empresa_id: v.empresa_ids?.[0] ?? null,
    acao: "editar",
    entidade: "usuario",
    entidade_id: id,
    dados_antes: antes as never,
    dados_depois: {
      ...antes,
      ...updates,
      empresa_ids: v.empresa_ids,
    } as never,
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
    .select("ativo")
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
    empresa_id: null,
    acao: ativo ? "ativar" : "inativar",
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

  const novaSenha = gerarSenhaProvisoria()
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

/**
 * Faz upload (ou remove) a foto de perfil de um usuário.
 * O arquivo chega via FormData. Retorna a URL pública final.
 * – Bucket "avatars" público, path: {userId}/avatar
 * – Upsert = sobrescreve sem precisar deletar antes
 * – Cache-buster no URL evita stale image no browser
 */
export async function atualizarFotoUsuario(
  userId: string,
  formData: FormData,
): Promise<ActionResult<{ foto_url: string | null }>> {
  const user = await requireCurrentUser()
  if (!can(user, "usuarios", "editar") && user.id !== userId) {
    return { ok: false, error: "Sem permissão para alterar foto." }
  }

  const supabase = await createClient()
  const remover = formData.get("remover") === "true"

  if (remover) {
    // RPC com SECURITY DEFINER — bypassa RLS em usuarios sem precisar de service role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("atualizar_foto_usuario", {
      p_user_id: userId,
      p_foto_url: null,
    })
    // Best-effort: tenta excluir arquivo do storage (ignora erros)
    await supabase.storage.from("avatars").remove([`${userId}/avatar`])
    revalidatePath("/usuarios")
    revalidatePath(`/usuarios/${userId}`)
    revalidatePath("/", "layout")
    return { ok: true, data: { foto_url: null } }
  }

  const file = formData.get("foto") as File | null
  if (!file || file.size === 0) {
    return { ok: true, data: { foto_url: null } }
  }

  // Validação de tamanho (2 MB)
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "A foto deve ter no máximo 2 MB." }
  }

  const path = `${userId}/avatar`
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { ok: false, error: uploadError.message }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path)

  // Cache-buster: força o browser a buscar a imagem nova após re-upload
  const fotoUrl = `${publicUrl}?t=${Date.now()}`

  // RPC com SECURITY DEFINER — bypassa RLS em usuarios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any).rpc("atualizar_foto_usuario", {
    p_user_id: userId,
    p_foto_url: fotoUrl,
  })

  if (updateError) return { ok: false, error: (updateError as { message: string }).message }

  revalidatePath("/usuarios")
  revalidatePath(`/usuarios/${userId}`)
  revalidatePath("/", "layout")
  return { ok: true, data: { foto_url: fotoUrl } }
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
