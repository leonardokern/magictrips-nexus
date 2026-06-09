import { cache } from "react"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database.types"

export type Permissoes = Record<string, Record<string, boolean>>

export type CurrentUserEmpresa = {
  id: string
  nome: string
  slug: string
}

export type CurrentUser = {
  id: string
  nome: string
  email: string
  iniciais: string | null
  foto_url: string | null
  ativo: boolean
  forcePasswordChange: boolean
  /** Empresas às quais o usuário tem acesso (1+). */
  empresas: CurrentUserEmpresa[]
  /** True quando o usuário tem acesso a todas as empresas ativas. */
  acessaTodasEmpresas: boolean
  perfil: {
    id: string
    nome: string
    sistema: boolean
    /**
     * Chave estável dos perfis sistema: 'admin' | 'gerente' | 'agente'.
     * NULL para perfis customizados. Use ESTA chave (não o nome) para
     * checagens de privilégio — o nome pode ser renomeado livremente.
     */
    chave_sistema: "admin" | "gerente" | "agente" | null
    /** "agente" = perfil de venda (vê dashboard próprio). "operacao" = admin/gerente. */
    tipo: "agente" | "operacao"
    permissoes: Permissoes
  }
}

/**
 * Carrega o usuário logado com perfil + empresas num único roundtrip via RPC.
 *
 * Fluxo otimizado:
 *  1. Lê x-nexus-user-id do header (injetado pelo middleware) — evita
 *     uma segunda chamada getUser() ao GoTrue quando o middleware já validou
 *     a sessão na mesma request.
 *  2. Se o header não estiver presente (ex: rota pública, SSR direto),
 *     cai no fallback seguro com getUser().
 *  3. Chama a RPC get_usuario_completo() — uma única roundtrip ao Postgres
 *     em vez de 3 (usuarios → perfis_acesso → usuarios_empresas + count).
 *
 * Memoizado por request via React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()

  // Tenta usar o userId injetado pelo middleware para evitar segundo getUser()
  const headersList = await headers()
  let userId = headersList.get("x-nexus-user-id")

  if (!userId) {
    // Fallback: valida sessão diretamente (rotas públicas, SSR sem middleware, etc.)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return null
    userId = authUser.id
  }

  // Uma única roundtrip ao banco em vez de 3 (ver migration 071)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_usuario_completo", {
    p_user_id: userId,
  })

  if (error || !data) return null

  const empresas: CurrentUserEmpresa[] = (data.empresas ?? []) as CurrentUserEmpresa[]
  const totalEmpresas = (data.total_empresas as number) ?? 0
  const acessaTodasEmpresas = empresas.length > 0 && empresas.length >= totalEmpresas

  return {
    id: data.id as string,
    nome: data.nome as string,
    email: data.email as string,
    iniciais: (data.iniciais as string | null) ?? null,
    foto_url: (data.foto_url as string | null) ?? null,
    ativo: data.ativo as boolean,
    forcePasswordChange: data.force_password_change as boolean,
    empresas,
    acessaTodasEmpresas,
    perfil: {
      id: data.perfil.id as string,
      nome: data.perfil.nome as string,
      sistema: data.perfil.sistema as boolean,
      chave_sistema:
        (data.perfil.chave_sistema as string | null) as
          | "admin"
          | "gerente"
          | "agente"
          | null ?? null,
      tipo: data.perfil.tipo === "agente" ? "agente" : "operacao",
      permissoes: (data.perfil.permissoes as Permissoes) ?? {},
    },
  }
})

/**
 * Versão estrita que lança erro se não houver usuário.
 * Usar em rotas garantidamente autenticadas (dentro de (dashboard)).
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Usuário não autenticado")
  }
  return user
}

// Re-exporta para conveniência
export type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"]
