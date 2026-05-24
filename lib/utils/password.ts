/**
 * Gera senha provisória aleatória legível.
 * Evita caracteres ambíguos (0/O, 1/l/I, etc.) para reduzir erros ao
 * comunicar a senha verbalmente ou copiar.
 */
const UPPER   = "ABCDEFGHJKLMNPQRSTUVWXYZ"        // sem I, O
const LOWER   = "abcdefghjkmnpqrstuvwxyz"          // sem i, l, o
const DIGITS  = "23456789"                          // sem 0, 1
const SYMBOLS = "!@#$%&*-+="

const ALPHANUM = UPPER + LOWER + DIGITS

/**
 * Gera senha de tamanho N (default 8) garantindo:
 *  - 1 maiúscula
 *  - 1 símbolo
 *  - restante = letras (maiúsculas/minúsculas) e dígitos
 *
 * O default mínimo (8 caracteres) é a regra do produto. Aceita `length`
 * maior pra resets ocasionais sob demanda.
 */
export function gerarSenhaProvisoria(length = 8): string {
  if (length < 8) throw new Error("Senha precisa de pelo menos 8 caracteres")

  const required = [pick(UPPER), pick(SYMBOLS)]
  const remaining = Array.from({ length: length - required.length }, () =>
    pick(ALPHANUM),
  )

  // embaralha (Fisher-Yates)
  const chars = [...required, ...remaining]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join("")
}

function pick(pool: string): string {
  return pool.charAt(Math.floor(Math.random() * pool.length))
}

/**
 * Deriva iniciais (2 letras maiúsculas) do nome completo.
 * "Marcelo Maciel" → "MM"
 * "Jéssica" → "JE"
 * "Ana Paula Santos" → "AS"
 */
export function derivarIniciais(nome: string): string {
  const parts = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(da|de|do|das|dos|e)$/i.test(p))

  if (parts.length === 0) return ""
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}
