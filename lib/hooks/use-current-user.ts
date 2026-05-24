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

  const { data: u, error: userErr } = await supabase
    .from("usuarios")
    .select("id, nome, email, iniciais, ativo, force_password_change, perfil_id")
    .eq("id", authUser.id)
    .single()

  if (userErr || !u) return null

  const [perfilRes, empresasRes, todasEmpresasRes] = await Promise.all([
    supabase
      .from("perfis_acesso")
      .select("id, nome, sistema, permissoes, tipo")
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
    ativo: u.ativo,
    forcePasswordChange: u.force_password_change,
    empresas,
    acessaTodasEmpresas,
    perfil: {
      id: perfilRes.data.id,
      nome: perfilRes.data.nome,
      sistema: perfilRes.data.sistema,
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
