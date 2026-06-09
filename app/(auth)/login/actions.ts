"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAppUrl } from "@/lib/utils/app-url"

export type EsqueciSenhaState = {
  error?: string
  success?: boolean
}

/**
 * Dispara o e-mail de recuperação de senha via Supabase Auth.
 * Sempre retorna sucesso para não revelar se o e-mail está cadastrado.
 */
export async function esquecerSenhaAction(
  _prevState: EsqueciSenhaState,
  formData: FormData,
): Promise<EsqueciSenhaState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Informe o e-mail." }

  const supabase = await createClient()

  // Supabase ignora silenciosamente se o e-mail não existir — não revela.
  // getAppUrl() resolve APP_URL → NEXT_PUBLIC_APP_URL → domínio prod Vercel
  // → localhost (cadeia em lib/utils/app-url.ts). Importante: o link gerado
  // pelo Supabase também precisa estar liberado no Auth → URL Configuration
  // → Redirect URLs no painel Supabase.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/redefinir-senha`,
  })

  return { success: true }
}

export type LoginState = {
  error?: string
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim()
  const senha = String(formData.get("senha") ?? "")

  if (!email || !senha) {
    return { error: "Informe e-mail e senha." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (error) {
    // Mensagens genéricas — não revelar se o email existe ou não.
    // NÃO logamos tentativas falhadas em audit_logs (poluiria histórico e
    // exporia padrões a quem pudesse ler a tabela). Histórico forense
    // mais detalhado fica como TODO em V2 numa tabela separada.
    if (error.message.toLowerCase().includes("invalid")) {
      return { error: "E-mail ou senha incorretos." }
    }
    return { error: "Não foi possível entrar. Tente novamente." }
  }

  // Login bem-sucedido → audit log.
  // Best-effort: falha no INSERT NÃO deve bloquear o login.
  try {
    const userId = data.user?.id
    if (userId) {
      await supabase.from("audit_logs").insert({
        usuario_id: userId,
        empresa_id: null,
        acao: "login",
        entidade: "usuario",
        entidade_id: userId,
      })
    }
  } catch {
    /* swallow — login não pode quebrar por log */
  }

  redirect("/dashboard")
}
