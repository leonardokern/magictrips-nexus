"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { derivarIniciais } from "@/lib/utils/password"
import { meuPerfilSenhaSchema } from "@/lib/schemas/usuario"

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export async function signOutAction() {
  const supabase = await createClient()
  // scope: 'local' não faz roundtrip pro Supabase Auth para invalidar a
  // sessão globalmente — apenas limpa cookies/sessão deste browser. UX
  // ganha ~300-1000ms; o JWT existente expira naturalmente em 1h.
  await supabase.auth.signOut({ scope: "local" })
  redirect("/login")
}

const nomeSchema = z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo")

export async function atualizarMeuNome(nome: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = nomeSchema.safeParse(nome)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Nome inválido." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("usuarios")
    .update({ nome: parsed.data, iniciais: derivarIniciais(parsed.data) })
    .eq("id", user.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function alterarSenhaEDeslogar(raw: unknown): Promise<ActionResult> {
  const parsed = meuPerfilSenhaSchema.safeParse(raw)
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

  if (error) return { ok: false, error: traduzirErroSenha(error.message) }

  await supabase.auth.signOut({ scope: "local" })
  return { ok: true }
}

function traduzirErroSenha(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("senha atual incorreta")) return "Senha atual incorreta."
  if (m.includes("nova senha")) return msg
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
