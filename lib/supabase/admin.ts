import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

/**
 * Cliente Supabase com service role — bypassa RLS.
 * Usar APENAS em Server Actions / Route Handlers onde o escopo
 * justifica acesso elevado (ex: gerar link de recovery).
 * NUNCA expor ao cliente (browser).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
