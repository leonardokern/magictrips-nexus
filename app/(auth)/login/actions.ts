"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAppUrl } from "@/lib/utils/app-url"
import { enviarEmailResetSenha } from "@/lib/email/send"

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

  // Usa o admin client para gerar o link de recovery sem enviar e-mail
  // pelo Supabase (que usa SMTP padrão limitado e não confiável).
  // O link é enviado via Resend, usando o domínio verificado do projeto.
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${getAppUrl()}/auth/callback?next=/redefinir-senha`,
    },
  })

  // Se o e-mail não existe no sistema, o Supabase retorna erro mas NÃO
  // revelamos isso ao usuário (evita user enumeration).
  if (!error && data?.properties?.action_link) {
    await enviarEmailResetSenha({
      to: email,
      resetUrl: data.properties.action_link,
    })
  }

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
