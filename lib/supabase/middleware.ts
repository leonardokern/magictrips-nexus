import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"

// /login → página de login
// /auth  → callback do Supabase (recovery, magic link, etc.)
// /redefinir-senha → acessível após recovery session (sem login normal)
const PUBLIC_ROUTES = ["/login", "/auth", "/redefinir-senha"]

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Atualiza a sessão Supabase (refresh do JWT) e protege rotas.
 *
 * Otimizações de performance:
 *  - Injeta x-nexus-user-id no header da request → getCurrentUser() usa esse
 *    ID diretamente e pula a segunda chamada getUser() ao GoTrue (~100ms/req).
 *  - As verificações de ativo/force_password_change são feitas com a mesma
 *    query que o middleware já faz — sem roundtrip extra.
 *
 * Regras:
 *  - Sem sessão + rota privada → redirect /login
 *  - Sessão + ativo=false → signOut + redirect /login?erro=inativo
 *  - Sessão + force_password_change=true (em rota != /alterar-senha) → redirect /alterar-senha
 *  - Sessão + rota /login → redirect /dashboard
 */
export async function updateSession(request: NextRequest) {
  // Headers mutáveis para propagar x-nexus-user-id às RSCs downstream.
  // Limpa qualquer valor forjado pelo cliente antes de processar.
  const reqHeaders = new Headers(request.headers)
  reqHeaders.delete("x-nexus-user-id")

  // Rastreia cookies com opções completas para remontar a response final
  const pendingCookies: CookieToSet[] = []

  let supabaseResponse = NextResponse.next({
    request: { headers: reqHeaders },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Atualiza cookies na request para o SSR client ler na mesma render
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Usa reqHeaders para que o x-nexus-user-id set depois seja incluído
          supabaseResponse = NextResponse.next({ request: { headers: reqHeaders } })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
            // Guarda com opções completas para replicar na response final
            pendingCookies.push({ name, value, options })
          })
        },
      },
    },
  )

  // IMPORTANTE: getUser() entre createServerClient e o return para refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  )

  // Sem sessão + rota privada → /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Com sessão: validar status (ativo + force_password_change)
  if (user) {
    const { data: dbUser } = await supabase
      .from("usuarios")
      .select("ativo, force_password_change")
      .eq("id", user.id)
      .single()

    // Usuário desativado → desloga
    if (dbUser && !dbUser.ativo) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("erro", "inativo")
      return NextResponse.redirect(url)
    }

    // Força troca de senha (exceto nas rotas de alteração/redefinição)
    if (
      dbUser?.force_password_change &&
      pathname !== "/alterar-senha" &&
      pathname !== "/redefinir-senha" &&
      pathname !== "/login"
    ) {
      const url = request.nextUrl.clone()
      url.pathname = "/alterar-senha"
      return NextResponse.redirect(url)
    }

    // Já logado e tentando ir pro /login → manda pro dashboard
    if (pathname === "/login") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    // ── Otimização: injeta userId para RSCs não precisarem chamar getUser() ──
    reqHeaders.set("x-nexus-user-id", user.id)

    // Reconstrói a response final com os headers atualizados.
    // Se setAll() foi chamado (refresh de JWT), reaplica os cookies com
    // suas opções completas (path, httpOnly, secure, etc.).
    supabaseResponse = NextResponse.next({ request: { headers: reqHeaders } })
    pendingCookies.forEach(({ name, value, options }) =>
      supabaseResponse.cookies.set(name, value, options),
    )
  }

  return supabaseResponse
}
