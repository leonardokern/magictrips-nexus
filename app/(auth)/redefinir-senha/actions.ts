"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { redefinirSenhaSchema } from "@/lib/schemas/usuario"

export type RedefinirSenhaState = {
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Redefine a senha após o usuário chegar via link de recuperação.
 * Não exige a senha atual — a sessão de recovery já valida a identidade.
 * Após o sucesso: limpa force_password_change, faz signOut e redireciona para /login.
 */
export async function redefinirSenhaAction(
  _prevState: RedefinirSenhaState,
  formData: FormData,
): Promise<RedefinirSenhaState> {
  const raw = {
    nova_senha: String(formData.get("nova_senha") ?? ""),
    confirmar_senha: String(formData.get("confirmar_senha") ?? ""),
  }

  const parsed = redefinirSenhaSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    const fieldErrors: Record<string, string> = {}
    for (const [k, msgs] of Object.entries(flat)) {
      if (msgs && msgs.length > 0 && msgs[0]) fieldErrors[k] = msgs[0]
    }
    return { error: "Verifique os campos.", fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: "Sessão expirada. Solicite um novo link de redefinição de senha.",
    }
  }

  // Atualiza a senha via Supabase Auth (recovery session já autenticada)
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.nova_senha,
  })

  if (updateError) {
    console.error("[redefinirSenha] updateUser:", updateError.message)
    return { error: "Não foi possível redefinir a senha. Tente novamente." }
  }

  // Limpa force_password_change caso esteja marcado (best-effort)
  await supabase
    .from("usuarios")
    .update({ force_password_change: false })
    .eq("id", user.id)

  // Desloga para o usuário entrar com a nova senha
  await supabase.auth.signOut({ scope: "local" })

  redirect("/login?aviso=senha-redefinida")
}
