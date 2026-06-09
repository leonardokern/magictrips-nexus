/**
 * Resolve a URL pública do app — usada em emails (botões "Acessar o Nexus",
 * links de reset de senha, etc.) onde URLs relativas não funcionam.
 *
 * Ordem de prioridade:
 *   1. APP_URL                          — server-only, configurado manualmente
 *   2. NEXT_PUBLIC_APP_URL              — exposto ao client também
 *   3. https://${VERCEL_PROJECT_PRODUCTION_URL}  — auto-injetado pela Vercel,
 *      sempre o domínio canônico de produção (não o URL de preview)
 *   4. http://localhost:3000            — dev local
 *
 * Por que a cadeia: na Vercel, mesmo sem APP_URL setado, o passo 3 pega o
 * domínio configurado no projeto (no nosso caso `nexus.magictrips.com.br`).
 * Em dev local, sem nenhum env, cai em localhost. Em PRs/previews, se quiser
 * que emails apontem pro preview, setar APP_URL manualmente naquele env.
 *
 * IMPORTANTE: nunca usar VERCEL_URL — esse aponta pro deploy específico
 * (`magictrips-nexus-71mfjju8p-leonardo-kern-s-projects.vercel.app`), o que
 * gera links bonitos hoje e quebrados amanhã (rotação de deploy).
 */
export function getAppUrl(): string {
  if (process.env.APP_URL) return stripTrailingSlash(process.env.APP_URL)
  if (process.env.NEXT_PUBLIC_APP_URL)
    return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return "http://localhost:3000"
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s
}
