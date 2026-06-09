import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Callback do Supabase Auth para fluxos de magic link e recovery.
 *
 * Quando o usuário clica no link de redefinição de senha, o Supabase
 * redireciona para este endpoint com `code` (PKCE) ou `token_hash`.
 * Trocamos pelo token de sessão e redirecionamos para `next` (padrão: /dashboard).
 *
 * Fluxo de redefinição:
 *   1. `esquecerSenhaAction` → resetPasswordForEmail(email, { redirectTo: '/auth/callback?next=/redefinir-senha' })
 *   2. Supabase envia e-mail com link → usuário clica
 *   3. Este handler troca o code por sessão → redirect /redefinir-senha
 *   4. Usuário define nova senha → redirect /login
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code      = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type      = searchParams.get("type")
  const next      = searchParams.get("next") ?? "/dashboard"

  const supabase = await createClient()

  if (code) {
    // Fluxo PKCE (padrão com @supabase/ssr)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession:", error.message)
      return NextResponse.redirect(`${origin}/login?erro=link-invalido`)
    }
  } else if (tokenHash && type) {
    // Fluxo legado com token hash
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery" | "email" | "magiclink" | "email_change" | "signup",
    })
    if (error) {
      console.error("[auth/callback] verifyOtp:", error.message)
      return NextResponse.redirect(`${origin}/login?erro=link-invalido`)
    }
  } else {
    return NextResponse.redirect(`${origin}/login?erro=link-invalido`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
