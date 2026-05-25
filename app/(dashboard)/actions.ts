"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function signOutAction() {
  const supabase = await createClient()
  // scope: 'local' não faz roundtrip pro Supabase Auth para invalidar a
  // sessão globalmente — apenas limpa cookies/sessão deste browser. UX
  // ganha ~300-1000ms; o JWT existente expira naturalmente em 1h.
  await supabase.auth.signOut({ scope: "local" })
  redirect("/login")
}
