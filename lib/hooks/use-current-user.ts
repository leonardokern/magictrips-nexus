import { cache } from "react"
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
 * Carrega o usuário logado com perfil + empresas (multi-empresa via N:N).
 * Memoizado por request via React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: u, error: userErr } = await (supabase as any)
    .from("usuarios")
    .select("id, nome, email, iniciais, foto_url, ativo, force_password_change, perfil_id")
    .eq("id", authUser.id)
    .single()

  if (userErr || !u) return null

  const [perfilRes, empresasRes, todasEmpresasRes] = await Promise.all([
    // Cast pra any: a coluna `chave_sistema` (migration 059) ainda não está
    // na geração de tipos do Supabase MCP — usamos cast manual com fallback
    // seguro no uso (linhas abaixo).
    (supabase as any)
      .from("perfis_acesso")
      .select("id, nome, sistema, permissoes, tipo, chave_sistema")
      .eq("id", u.perfil_id)
      .single(),
    supabase
      .from("usuarios_empresas")
      .select("empresa:empresas(id, nome, slug)")
      .eq("usuario_id", u.id),
    supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
  ])

  if (perfilRes.error || !perfilRes.data) return null

  const empresas: CurrentUserEmpresa[] = (empresasRes.data ?? [])
    .map((row) => row.empresa)
    .filter((e): e is CurrentUserEmpresa => e !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

  const totalEmpresas = todasEmpresasRes.count ?? 0
  const acessaTodasEmpresas = empresas.length > 0 && empresas.length >= totalEmpresas

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    iniciais: u.iniciais,
    foto_url: (u.foto_url as string | null) ?? null,
    ativo: u.ativo,
    forcePasswordChange: u.force_password_change,
    empresas,
    acessaTodasEmpresas,
    perfil: {
      id: perfilRes.data.id,
      nome: perfilRes.data.nome,
      sistema: perfilRes.data.sistema,
      chave_sistema:
        (perfilRes.data as { chave_sistema?: string | null }).chave_sistema as
          | "admin"
          | "gerente"
          | "agente"
          | null ?? null,
      tipo: (perfilRes.data.tipo === "agente" ? "agente" : "operacao"),
      permissoes: (perfilRes.data.permissoes as Permissoes) ?? {},
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
