import "server-only"
import Anthropic from "@anthropic-ai/sdk"

/**
 * Cliente singleton do Anthropic SDK.
 * Requer ANTHROPIC_API_KEY no ambiente.
 *
 * Usado para extração de dados de cotações de fornecedores (PDFs e HTML)
 * via Claude — ponto central para configuração de modelo, limites e logs.
 */

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    "ANTHROPIC_API_KEY não está definida. " +
    "Adicione ao .env.local para desenvolvimento ou às variáveis de ambiente do Vercel para produção.",
  )
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/** Modelo padrão para extração de cotações — balanço custo/qualidade. */
export const COTACAO_MODEL = "claude-sonnet-4-5" as const
