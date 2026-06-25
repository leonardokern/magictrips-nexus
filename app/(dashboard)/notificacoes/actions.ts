"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

/** Marca um lembrete como dispensado (após o usuário clicar/ler). */
export async function dispensarLembrete(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("lembretes")
    .update({ status: "dispensado" })
    .eq("id", id)
    .eq("destinatario_id", user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Marca TODOS os lembretes pendentes do usuário corrente como dispensados.
 * Disparado pelo "Marcar tudo como lido" no dropdown de notificações.
 */
export async function dispensarTodosLembretes(): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("lembretes")
    .update({ status: "dispensado" })
    .eq("destinatario_id", user.id)
    .eq("status", "pendente")
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard")
  return { ok: true }
}
