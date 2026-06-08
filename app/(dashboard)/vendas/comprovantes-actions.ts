"use server"

import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import {
  MAX_ANEXO_BYTES,
  MIMES_ACEITOS,
} from "@/lib/schemas/anexo"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

/**
 * Comprovantes de cobrança — cada item de cobranca_cliente_itens tem um
 * arquivo de comprovante de pagamento (PDF ou imagem). Diferente dos
 * anexos da venda (que ficam em `venda_anexos`), os comprovantes vivem
 * inline em `cobranca_cliente_itens.comprovante_*`.
 *
 * O arquivo é salvo no MESMO bucket dos anexos da venda (`venda-anexos`)
 * mas em namespace separado: `comprovantes/<uuid>.<ext>`.
 *
 * O bucket é privado — visualização só via signed URL gerada pelo server.
 */

const BUCKET = "venda-anexos"
const COMPROVANTE_PREFIX = "comprovantes"

export type ComprovanteUploadResult = {
  storagePath: string
  nomeArquivo: string
  mimeType: string
  tamanhoBytes: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recebe um arquivo (via FormData) e o sobe pro bucket. Retorna os
 * metadados que devem ser persistidos no item de cobrança.
 *
 * - Valida MIME (PDF ou imagem) e tamanho (≤ 10 MB)
 * - Path gerado: `comprovantes/<uuid>.<ext>`
 * - Não cria registro em tabela — a persistência fica a cargo do RPC
 *   `criar_venda_completa` / `editar_venda_completa` quando a venda é salva.
 */
export async function uploadComprovanteCobranca(
  formData: FormData,
): Promise<ActionResult<ComprovanteUploadResult>> {
  await requireCurrentUser()

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo inválido." }
  }

  if (file.size > MAX_ANEXO_BYTES) {
    return {
      ok: false,
      error: `Arquivo excede ${Math.round(MAX_ANEXO_BYTES / 1024 / 1024)} MB.`,
    }
  }

  const mime = file.type || "application/octet-stream"
  if (!MIMES_ACEITOS.includes(mime as (typeof MIMES_ACEITOS)[number])) {
    return {
      ok: false,
      error: "Tipo de arquivo não suportado. Use PDF ou imagem (JPG, PNG, WEBP, GIF).",
    }
  }

  // Path: comprovantes/<uuid>.<ext> — mantém extensão pra UX (download).
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 5)
  const anexoId = crypto.randomUUID()
  const storagePath = `${COMPROVANTE_PREFIX}/${anexoId}.${ext}`

  const supabase = await createClient()
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mime,
      upsert: false,
    })

  if (uploadErr) {
    return { ok: false, error: `Falha no upload: ${uploadErr.message}` }
  }

  return {
    ok: true,
    data: {
      storagePath,
      nomeArquivo: file.name,
      mimeType: mime,
      tamanhoBytes: file.size,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Visualização (signed URL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera URL assinada (60 min) para abrir o comprovante em nova aba.
 * O usuário precisa ter permissão de leitura na venda — checamos via RLS
 * implícita: se o storagePath vier de uma venda visível ao usuário, ok.
 *
 * Pra evitar enumeração de paths, o caller deve ter passado um path
 * obtido de uma venda que ele já tem acesso (controlado em camada acima).
 */
export async function obterUrlComprovante(
  storagePath: string,
): Promise<ActionResult<{ url: string }>> {
  await requireCurrentUser()

  if (!storagePath || !storagePath.startsWith(`${COMPROVANTE_PREFIX}/`)) {
    return { ok: false, error: "Path inválido." }
  }

  const supabase = await createClient()
  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60) // 1h

  if (error || !signed) {
    return { ok: false, error: error?.message ?? "Falha ao gerar URL." }
  }
  return { ok: true, data: { url: signed.signedUrl } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exclusão (best-effort — limpeza imediata)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove o arquivo do bucket. Usado quando o operador troca o
 * comprovante de uma cobrança ou exclui o item. Best-effort: se falhar,
 * o arquivo vira órfão (limpeza via job futuro).
 */
export async function excluirComprovante(
  storagePath: string,
): Promise<ActionResult> {
  await requireCurrentUser()
  if (!storagePath || !storagePath.startsWith(`${COMPROVANTE_PREFIX}/`)) {
    return { ok: false, error: "Path inválido." }
  }
  const supabase = await createClient()
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => null)
  return { ok: true }
}
