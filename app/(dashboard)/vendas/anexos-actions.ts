"use server"

import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import {
  MAX_ANEXOS_POR_VENDA,
  MAX_ANEXO_BYTES,
  MIMES_ACEITOS,
  type AnexoVenda,
} from "@/lib/schemas/anexo"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

/** Bucket de storage onde os arquivos são salvos (privado — só via signed URL). */
const BUCKET = "venda-anexos"

// ─────────────────────────────────────────────────────────────────────────────
// Listagem
// ─────────────────────────────────────────────────────────────────────────────

/** Lista anexos da venda OU da sessão pendente (escolha um — passe o outro como null). */
export async function listarAnexos(args: {
  vendaId?: string | null
  wizardSessionId?: string | null
}): Promise<ActionResult<AnexoVenda[]>> {
  await requireCurrentUser()
  const supabase = await createClient()
  const { vendaId = null, wizardSessionId = null } = args

  if (!vendaId && !wizardSessionId) return { ok: true, data: [] }

  let query = supabase
    .from("venda_anexos")
    .select(
      "id, nome_arquivo, mime_type, tamanho_bytes, storage_path, created_at, created_by",
    )
    .order("created_at", { ascending: true })

  if (vendaId) query = query.eq("venda_id", vendaId)
  else if (wizardSessionId)
    query = query.eq("wizard_session_id", wizardSessionId)

  const { data, error } = await query
  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id,
      nomeArquivo: r.nome_arquivo,
      mimeType: r.mime_type,
      tamanhoBytes: r.tamanho_bytes,
      storagePath: r.storage_path,
      createdAt: r.created_at,
      createdById: r.created_by,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload — recebe File via FormData
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Faz upload de UM anexo. O caller deve enviar exatamente um arquivo por
 * chamada (mantém UX previsível com progresso por arquivo).
 *
 * Path no bucket: `anexos/{anexoId}.{ext}` — o `anexoId` é gerado no
 * cliente; usar UUID garante unicidade e evita colisão entre vendas.
 */
export async function uploadAnexo(formData: FormData): Promise<
  ActionResult<AnexoVenda>
> {
  const user = await requireCurrentUser()
  const supabase = await createClient()

  const file = formData.get("file")
  const vendaId = (formData.get("vendaId") as string | null) || null
  const wizardSessionId =
    (formData.get("wizardSessionId") as string | null) || null

  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo inválido." }
  }
  if (!vendaId && !wizardSessionId) {
    return { ok: false, error: "vendaId ou wizardSessionId obrigatório." }
  }
  if (file.size === 0) {
    return { ok: false, error: "Arquivo vazio." }
  }
  if (file.size > MAX_ANEXO_BYTES) {
    return { ok: false, error: "Anexo maior que 10 MB." }
  }
  if (!(MIMES_ACEITOS as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Tipo de arquivo não permitido (use PDF ou imagem)." }
  }

  // Verifica limite (defesa em profundidade — trigger no banco também valida)
  const { count } = await supabase
    .from("venda_anexos")
    .select("id", { count: "exact", head: true })
    .match(vendaId ? { venda_id: vendaId } : { wizard_session_id: wizardSessionId })
  if ((count ?? 0) >= MAX_ANEXOS_POR_VENDA) {
    return { ok: false, error: `Limite de ${MAX_ANEXOS_POR_VENDA} anexos por venda.` }
  }

  // Path: anexos/{uuid}.{ext}
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin"
  const storagePath = `anexos/${crypto.randomUUID()}.${ext}`

  // Upload pro storage
  const arrayBuffer = await file.arrayBuffer()
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })
  if (upErr) return { ok: false, error: `Falha no upload: ${upErr.message}` }

  // Insere registro
  const { data, error: insErr } = await supabase
    .from("venda_anexos")
    .insert({
      venda_id: vendaId,
      wizard_session_id: wizardSessionId,
      storage_path: storagePath,
      nome_arquivo: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
      created_by: user.id,
    })
    .select("id, nome_arquivo, mime_type, tamanho_bytes, storage_path, created_at, created_by")
    .single()

  if (insErr || !data) {
    // Rollback storage se falhar o registro
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => null)
    return { ok: false, error: insErr?.message ?? "Falha ao registrar anexo." }
  }

  return {
    ok: true,
    data: {
      id: data.id,
      nomeArquivo: data.nome_arquivo,
      mimeType: data.mime_type,
      tamanhoBytes: data.tamanho_bytes,
      storagePath: data.storage_path,
      createdAt: data.created_at,
      createdById: data.created_by,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exclusão
// ─────────────────────────────────────────────────────────────────────────────

export async function excluirAnexo(anexoId: string): Promise<ActionResult> {
  await requireCurrentUser()
  const supabase = await createClient()

  // Lê o path antes de deletar — precisamos pra limpar o bucket
  const { data: row, error: getErr } = await supabase
    .from("venda_anexos")
    .select("storage_path")
    .eq("id", anexoId)
    .maybeSingle()
  if (getErr) return { ok: false, error: getErr.message }
  if (!row) return { ok: false, error: "Anexo não encontrado." }

  const { error: delErr } = await supabase
    .from("venda_anexos")
    .delete()
    .eq("id", anexoId)
  if (delErr) return { ok: false, error: delErr.message }

  // Best-effort cleanup do storage — se falhar, o registro já está removido
  await supabase.storage.from(BUCKET).remove([row.storage_path]).catch(() => null)

  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migração session_id → venda_id (chamado após criar a venda)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Associa anexos uploadados durante o wizard (com `wizard_session_id`) à
 * venda criada (`vendaId`). Idempotente — se não houver pendentes, no-op.
 */
export async function migrarAnexosParaVenda(
  wizardSessionId: string,
  vendaId: string,
): Promise<ActionResult> {
  await requireCurrentUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from("venda_anexos")
    .update({ venda_id: vendaId, wizard_session_id: null })
    .eq("wizard_session_id", wizardSessionId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signed URL (abrir em nova aba)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera URL assinada para visualização do anexo numa nova aba. TTL curto
 * (5 min) — o link é gerado on-demand no clique. Forçamos
 * `Content-Disposition: inline` para o browser renderizar em vez de
 * baixar (PDF abre no viewer, imagem renderiza inline).
 */
export async function obterUrlAnexo(
  anexoId: string,
): Promise<ActionResult<{ url: string; nomeArquivo: string }>> {
  await requireCurrentUser()
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("venda_anexos")
    .select("storage_path, nome_arquivo")
    .eq("id", anexoId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: "Anexo não encontrado." }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60 * 5, {
      download: false, // inline rendering
    })
  if (signErr || !signed) {
    return { ok: false, error: signErr?.message ?? "Falha ao gerar URL." }
  }

  return { ok: true, data: { url: signed.signedUrl, nomeArquivo: row.nome_arquivo } }
}
