import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database.types"

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 * Usa cookies do Next.js para persistir a sessão. Sujeito a RLS.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component invocado sem context de mutação de cookies —
            // ignorar. Middleware cuida do refresh da sessão.
          }
        },
      },
    },
  )
}

