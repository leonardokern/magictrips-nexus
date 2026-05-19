"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

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
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (error) {
    // Mensagens genéricas — não revelar se o email existe ou não
    if (error.message.toLowerCase().includes("invalid")) {
      return { error: "E-mail ou senha incorretos." }
    }
    return { error: "Não foi possível entrar. Tente novamente." }
  }

  redirect("/dashboard")
}
