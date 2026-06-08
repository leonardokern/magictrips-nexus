import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Catálogo de chaves conhecidas. Adicionar aqui ao criar nova flag pra ter
 * autocompletar e detectar uso de chave inválida em build.
 */
export type FeatureFlagKey = "agenda" | "propostas"

export type Ambiente = "dev" | "prod"

/**
 * Detecta o ambiente em runtime usando, em ordem:
 *   1. `VERCEL_ENV` (production | preview | development) — setado pela Vercel
 *   2. `NODE_ENV` (production | development) — padrão Node
 *
 * Considera "prod" apenas quando claramente em produção real. Preview deploys
 * são tratados como "dev" pra permitir testar features ainda não publicadas.
 */
export function getAmbiente(): Ambiente {
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv === "production") return "prod"
  if (vercelEnv === "preview" || vercelEnv === "development") return "dev"
  if (process.env.NODE_ENV === "production") return "prod"
  return "dev"
}

/**
 * Lê uma feature flag com a seguinte ordem de precedência:
 *
 *   1. **Env var override** (`FEATURE_<CHAVE>=true|false`):
 *      Escape hatch pra forçar um valor sem mexer no banco. Útil pra
 *      depurar comportamento sem precisar de toggle UI. Em produção
 *      deixe desativada — o banco é a fonte de verdade.
 *
 *   2. **Coluna do banco do ambiente atual** (`ativo_dev` ou `ativo_prod`):
 *      Fonte canônica. Administrador controla via UI em `/feature-flags`.
 *
 * Cacheado por request via `cache()` do React (dedupe nativo).
 */
export async function isFeatureEnabled(chave: FeatureFlagKey): Promise<boolean> {
  // 1) Override por env var
  const envKey = `FEATURE_${chave.toUpperCase()}`
  const envVal = process.env[envKey]
  if (envVal === "true") return true
  if (envVal === "false") return false

  // 2) Banco — coluna do ambiente atual
  const flags = await getFlagsCached()
  return flags[chave] === true
}

/**
 * Carrega todas as flags e indexa por chave, escolhendo `ativo_dev` ou
 * `ativo_prod` conforme o ambiente atual. Cacheado por request.
 */
const getFlagsCached = cache(async (): Promise<Record<string, boolean>> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("feature_flags")
    .select("chave, ativo_dev, ativo_prod")
  const env = getAmbiente()
  const map: Record<string, boolean> = {}
  for (const f of data ?? []) {
    map[f.chave] = env === "prod" ? Boolean(f.ativo_prod) : Boolean(f.ativo_dev)
  }
  return map
})
