import { onlyDigits } from "./formatters"

/**
 * Resposta do ViaCEP (apenas os campos que usamos).
 * https://viacep.com.br/ws/CEP/json/
 */
type ViaCEPResponse = {
  cep: string
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export type EnderecoCEP = {
  rua: string
  bairro: string
  cidade: string
  uf: string
}

/**
 * Busca endereço pelo CEP via ViaCEP (gratuito, sem auth).
 * Retorna null se inválido ou não encontrado.
 */
export async function buscarEnderecoPorCep(
  cep: string,
): Promise<EnderecoCEP | null> {
  const limpo = onlyDigits(cep)
  if (limpo.length !== 8) return null

  try {
    const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
    if (!r.ok) return null
    const data = (await r.json()) as ViaCEPResponse
    if (data.erro) return null
    return {
      rua: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    }
  } catch {
    return null
  }
}
