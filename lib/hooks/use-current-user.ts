import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database.types"

export type Permissoes = Record<string, Record<string, boolean>>

export type CurrentUser = {
  id: string
  nome: string
  email: string
  iniciais: string | null
  ativo: boolean
  forcePasswordChange: boolean
  empresa: {
    id: string
    nome: string
    slug: string
  } | null
  perfil: {
    id: string
    nome: string
    sistema: boolean
    permissoes: Permissoes
  }
}

/**
 * Carrega o usuário logado com perfil + empresa.
 * Memoizado por request via React `cache` — várias chamadas no mesmo render
 * fazem só uma query (na real, até 3 paralelas, mas só uma vez).
 *
 * Estratégia: 3 queries paralelas em vez de 1 join, para evitar quirks do
 * type inference do supabase-js em modo strict.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: u, error: userErr } = await supabase
    .from("usuarios")
    .select(
      "id, nome, email, iniciais, ativo, force_password_change, perfil_id, empresa_id",
    )
    .eq("id", authUser.id)
    .single()

  if (userErr || !u) return null

  const [perfilRes, empresaRes] = await Promise.all([
    supabase
      .from("perfis_acesso")
      .select("id, nome, sistema, permissoes")
      .eq("id", u.perfil_id)
      .single(),
    u.empresa_id
      ? supabase
          .from("empresas")
          .select("id, nome, slug")
          .eq("id", u.empresa_id)
          .single()
      : Promise.resolve({ data: null, error: null } as const),
  ])

  if (perfilRes.error || !perfilRes.data) return null

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    iniciais: u.iniciais,
    ativo: u.ativo,
    forcePasswordChange: u.force_password_change,
    empresa: empresaRes.data
      ? {
          id: empresaRes.data.id,
          nome: empresaRes.data.nome,
          slug: empresaRes.data.slug,
        }
      : null,
    perfil: {
      id: perfilRes.data.id,
      nome: perfilRes.data.nome,
      sistema: perfilRes.data.sistema,
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
