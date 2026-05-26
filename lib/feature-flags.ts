import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Catálogo de chaves conhecidas. Adicionar aqui ao criar nova flag pra ter
 * autocompletar e detectar uso de chave inválida em build.
 */
export type FeatureFlagKey = "agenda"

/**
 * Lê todas as feature flags do banco. Cacheado por request via `cache()` do
 * React (dedupe nativo) — múltiplas chamadas no mesmo render compartilham o
 * mesmo resultado, mas cada request faz uma query fresh.
 *
 * Não usamos `unstable_cache` aqui porque ele proíbe acesso a `cookies()`
 * dentro do escopo cacheado, e o `createClient()` precisa de cookies pra
 * estabelecer a sessão. Como a tabela é pequena (1-2 linhas) e a RLS já
 * cobre com cache de plano interno do Postgres, o custo é desprezível.
 */
const getFlagsCached = cache(async (): Promise<Record<string, boolean>> => {
  const supabase = await createClient()
  const { data } = await supabase.from("feature_flags").select("chave, ativo")
  const map: Record<string, boolean> = {}
  for (const f of data ?? []) {
    map[f.chave] = Boolean(f.ativo)
  }
  return map
})

/** Retorna `true` se a flag existe e está ativa. */
export async function isFeatureEnabled(chave: FeatureFlagKey): Promise<boolean> {
  const flags = await getFlagsCached()
  return flags[chave] === true
}
