/**
 * Constantes e tipos compartilhados de anexos de venda. Separado dos
 * server actions porque arquivos `"use server"` só podem exportar
 * funções async — constantes e tipos vão aqui.
 */

/** Limite máximo de anexos por venda. */
export const MAX_ANEXOS_POR_VENDA = 10

/** Tamanho máximo de cada anexo em bytes (10 MB). */
export const MAX_ANEXO_BYTES = 10 * 1024 * 1024

/** Mime types aceitos — espelha o CHECK na tabela e o bucket. */
export const MIMES_ACEITOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

export type AnexoVenda = {
  id: string
  nomeArquivo: string
  mimeType: string
  tamanhoBytes: number
  storagePath: string
  createdAt: string
  createdById: string
}
