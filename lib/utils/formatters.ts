/**
 * Formatadores de dados (somente leitura).
 * Toda entrada de dados validados deve guardar a versão "limpa" no banco.
 */

/**
 * Apenas dígitos. "123.456.789-00" → "12345678900"
 */
export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "")
}

/**
 * Capitaliza a primeira letra de cada palavra e mantém as demais em
 * minúscula. Útil pra normalizar nomes ao sair do campo:
 *   "JOÃO PEDRO da SILVA"  →  "João Pedro Da Silva"
 *
 * Preserva espaços (inclusive sequências) e acentos. Usa `pt-BR` no
 * `toLocaleUpperCase` pra garantir comportamento correto com chars
 * Unicode (ç, ã, é, ñ, etc).
 */
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return ""
  return input
    .toLowerCase()
    .split(/(\s+)/)
    .map((parte) => {
      if (!parte || /^\s+$/.test(parte)) return parte
      return parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1)
    })
    .join("")
}

/**
 * Formata CPF: "12345678900" → "123.456.789-00"
 * Aceita string com ou sem máscara.
 */
export function formatCpf(cpf: string | null | undefined): string {
  const d = onlyDigits(cpf)
  if (d.length !== 11) return cpf ?? ""
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Formata CNPJ: "12345678000199" → "12.345.678/0001-99"
 * Só aplica a máscara completa com 14 dígitos.
 */
export function formatCnpj(cnpj: string | null | undefined): string {
  const d = onlyDigits(cnpj)
  if (d.length !== 14) return cnpj ?? ""
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Formata CNPJ progressivamente enquanto o usuário digita.
 * Sempre aceita apenas dígitos e aplica os separadores conforme o comprimento.
 * "12"          → "12"
 * "12345"       → "12.345"
 * "12345678"    → "12.345.678"
 * "123456780001"→ "12.345.678/0001"
 * "12345678000199" → "12.345.678/0001-99"
 */
export function formatCnpjPartial(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Formata telefone progressivamente enquanto o usuário digita.
 * Mantém apenas dígitos e aplica a máscara até 11 dígitos.
 * "(11) 9" → "(11) 9"   |   "(11) 91234-5678" (11 dígitos)
 */
export function formatTelefonePartial(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length === 0) return ""
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/**
 * Formata telefone brasileiro:
 *  - 11 dígitos (celular): "(11) 91234-5678"
 *  - 10 dígitos (fixo):    "(11) 1234-5678"
 *  - menos: retorna como veio
 */
export function formatTelefone(tel: string | null | undefined): string {
  const d = onlyDigits(tel)
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  return tel ?? ""
}

/**
 * "12345678" → "12345-678". Progressivo: aceita string parcial enquanto
 * o usuário digita (5 dígitos → "12345"; 6+ dígitos → "12345-6...").
 */
export function formatCep(cep: string | null | undefined): string {
  const d = onlyDigits(cep).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/**
 * "2026-05-19" (ISO) → "19/05/2026"
 * Aceita date string ISO ou Date.
 *
 * Para datas `date` puras (sem hora), o caller passa "YYYY-MM-DD" e
 * tratamos como meia-noite local — sem timezone shift indesejado.
 */
export function formatDateBr(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(`${iso}T00:00:00`) : iso
  if (Number.isNaN(d.getTime())) return ""
  const dia = String(d.getDate()).padStart(2, "0")
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  return `${dia}/${mes}/${d.getFullYear()}`
}

// Timezone canônico do sistema. NÃO use `Date.getHours()` ou
// `toLocaleString()` sem timezone explícito — em Server Components rodando
// na Vercel (UTC), `getHours()` retorna a hora UTC e o usuário no Brasil
// vê -3h. Sempre passe pelo formatador abaixo.
const TZ_BR = "America/Sao_Paulo"

const FMT_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ_BR,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ_BR,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

/**
 * Timestamp ISO 8601 (timestamptz do Postgres) → "19/05/2026 às 14:32"
 * em horário de Brasília. Funciona idêntico em server e client.
 */
export function formatDataHoraBr(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : ""
  // Intl com "pt-BR" devolve "19/05/2026, 14:32" — trocamos a vírgula por "às"
  return FMT_DATA_HORA.format(d).replace(",", " às")
}

/**
 * Timestamp ISO 8601 → "19/05/2026" em horário de Brasília.
 * Use quando precisar mostrar só a data mas o timestamp original tem hora.
 */
export function formatDataBrTz(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : ""
  return FMT_DATA.format(d)
}

/**
 * "19/05/2026" → "2026-05-19" (ISO date sem timezone)
 * Retorna null se inválida.
 */
export function parseDateBr(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim())
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const iso = `${yyyy}-${mm}-${dd}`
  const test = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(test.getTime())) return null
  return iso
}

/**
 * Valor numérico → "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}
