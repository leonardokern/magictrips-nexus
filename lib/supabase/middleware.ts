import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database.types"

// Apenas /login é totalmente pública. /alterar-senha exige sessão (o usuário
// precisa estar logado pra trocar a própria senha).
const PUBLIC_ROUTES = ["/login"]

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Atualiza a sessão Supabase (refresh do JWT) e protege rotas.
 *
 * Regras:
 *  - Sem sessão + rota privada → redirect /login
 *  - Sessão + ativo=false → signOut + redirect /login?erro=inativo
 *  - Sessão + force_password_change=true (em rota != /alterar-senha) → redirect /alterar-senha
 *  - Sessão + rota /login → redirect /dashboard
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
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

    // Força troca de senha (qualquer rota exceto a própria /alterar-senha)
    if (
      dbUser?.force_password_change &&
      pathname !== "/alterar-senha" &&
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
  }

  return supabaseResponse
}
