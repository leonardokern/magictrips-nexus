"use server"

import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { anthropic, COTACAO_MODEL } from "@/lib/anthropic"
import type { ActionResult } from "@/app/(dashboard)/propostas/actions"

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type ProdutoExtraido = {
  tipoProdutoNome: string      // "Aéreo", "Hotel", "Seguro", "Transfer", "Cruzeiro"…
  descricao: string | null     // "GRU → CDG / AF457 - Economy"
  dataInicioStr: string | null // DD/MM/AAAA
  dataFimStr: string | null
  pax: number
  valorVendaStr: string | null // "2.500,00"
  observacoes: string | null
}

export type CotacaoExtraida = {
  clienteNome: string | null
  clienteEmail: string | null
  clienteTelefone: string | null
  origem: string | null
  destino: string | null
  validadeStr: string | null   // DD/MM/AAAA
  observacoes: string | null
  produtos: ProdutoExtraido[]
  fornecedorDetectado: string | null  // "Incomum", "Skyplus", "OTT"…
}

export type CotacaoResultado =
  | { tipo: "concluido"; dados: CotacaoExtraida; cotacaoId: string }
  | { tipo: "spa"; mensagem: string }
  | { tipo: "erro"; mensagem: string }

// Tabelas novas ainda sem tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

/** Bucket onde os arquivos das cotações ficam armazenados. */
const BUCKET = "proposta-cotacoes"

// ─── Prompt de extração ───────────────────────────────────────────────────────

const PROMPT_EXTRACAO = `Você é um assistente especializado em extrair dados de cotações de viagens de documentos de fornecedores brasileiros (Skyplus, Incomum, OTT Consolidadora, Orinter, HotelDO, Expedia TAAP, entre outros).

Analise o documento fornecido e extraia as seguintes informações em formato JSON. Se um campo não for encontrado, use null. Não invente valores.

Regras:
- Datas: sempre no formato DD/MM/AAAA
- Valores monetários: formato brasileiro sem símbolo (ex: "2.500,00")
- PAX: número de passageiros/pessoas (padrão: 1 se não informado)
- tipoProdutoNome: use exatamente um destes valores: "Aéreo", "Hotel", "Cruzeiro", "Transfer", "Seguro", "Pacote". Se não se encaixar, use o nome mais próximo.
- Se houver múltiplos trechos de voo, crie um produto para cada trecho.
- Se houver múltiplos hotéis, crie um produto para cada hotel.
- Para voos: coloque no campo descricao o trecho (ex: "GRU → CDG") e companhia aérea se disponível.
- Para hotéis: coloque no campo descricao o nome do hotel, categoria e regime (ex: "Hotel Le Marais ★★★★ - Café da manhã incluído").

Retorne SOMENTE o JSON, sem explicações, sem markdown, sem formatação adicional.

Schema obrigatório:
{
  "clienteNome": string | null,
  "clienteEmail": string | null,
  "clienteTelefone": string | null,
  "origem": string | null,
  "destino": string | null,
  "validadeStr": string | null,
  "observacoes": string | null,
  "fornecedorDetectado": string | null,
  "produtos": [
    {
      "tipoProdutoNome": string,
      "descricao": string | null,
      "dataInicioStr": string | null,
      "dataFimStr": string | null,
      "pax": number,
      "valorVendaStr": string | null,
      "observacoes": string | null
    }
  ]
}`

// ─── Palavras-chave que indicam conteúdo útil de viagem (anti-SPA) ────────────

const KEYWORDS_VIAGEM = [
  "hotel", "aéreo", "voo", "passagem", "hospedagem", "diária",
  "viagem", "destino", "embarque", "chegada", "saída", "check-in",
  "passageiro", "pax", "cotação", "orçamento", "proposta", "valor",
  "tarifa", "seguro", "transfer", "cruzeiro", "itinerário",
]

function temConteudoViagem(html: string): boolean {
  const lower = html.toLowerCase()
  return KEYWORDS_VIAGEM.some((kw) => lower.includes(kw))
}

// ─── Upload de PDF ────────────────────────────────────────────────────────────

export async function uploadCotacaoPDF(
  formData: FormData,
): Promise<ActionResult<{ cotacaoId: string }>> {
  const user = await requireCurrentUser()
  const file = formData.get("file")

  if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido." }
  if (file.type !== "application/pdf")
    return { ok: false, error: "Apenas arquivos PDF são aceitos." }
  if (file.size === 0) return { ok: false, error: "Arquivo vazio." }
  if (file.size > 20 * 1024 * 1024)
    return { ok: false, error: "Arquivo maior que 20 MB." }

  const supabase = await createClient()
  const db = supabase as AnyClient

  const empresaId = user.empresas[0]?.id
  if (!empresaId) return { ok: false, error: "Usuário sem empresa associada." }

  // Upload para o Supabase Storage
  const ext = "pdf"
  const storagePath = `cotacoes/${crypto.randomUUID()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: "application/pdf",
      upsert: false,
    })
  if (upErr) return { ok: false, error: `Falha no upload: ${upErr.message}` }

  // Insere registro
  const { data, error: insErr } = await db
    .from("proposta_cotacoes")
    .insert({
      empresa_id: empresaId,
      usuario_id: user.id,
      tipo_entrada: "pdf",
      nome_arquivo: file.name,
      mime_type: "application/pdf",
      tamanho_bytes: file.size,
      storage_path: storagePath,
      status: "pendente",
    })
    .select("id")
    .single()

  if (insErr || !data) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => null)
    return { ok: false, error: insErr?.message ?? "Falha ao registrar cotação." }
  }

  return { ok: true, data: { cotacaoId: data.id } }
}

// ─── Fetch de URL ─────────────────────────────────────────────────────────────

export async function fetchUrlCotacao(
  url: string,
): Promise<CotacaoResultado> {
  const user = await requireCurrentUser()

  // Valida URL básica
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { tipo: "erro", mensagem: "URL inválida." }
    }
  } catch {
    return { tipo: "erro", mensagem: "URL inválida." }
  }

  // Tenta buscar o HTML
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Nexus/1.0; +https://compass.magictrips.com.br)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    })
    html = await res.text()
  } catch {
    return {
      tipo: "erro",
      mensagem:
        "Não foi possível acessar a URL. Verifique se ela está acessível publicamente.",
    }
  }

  // Detecta SPA / conteúdo insuficiente
  const htmlLimpo = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (htmlLimpo.length < 3_000 || !temConteudoViagem(htmlLimpo)) {
    return {
      tipo: "spa",
      mensagem:
        "Esta página carrega os dados via JavaScript e não é possível lê-la automaticamente. " +
        "Abra-a no seu navegador, use Ctrl+P → Salvar como PDF e faça o upload do arquivo.",
    }
  }

  // Conteúdo suficiente — salva e extrai
  const supabase = await createClient()
  const db = supabase as AnyClient
  const empresaId = user.empresas[0]?.id
  if (!empresaId) return { tipo: "erro", mensagem: "Usuário sem empresa." }

  const { data: row, error: insErr } = await db
    .from("proposta_cotacoes")
    .insert({
      empresa_id: empresaId,
      usuario_id: user.id,
      tipo_entrada: "url",
      nome_arquivo: parsed.hostname + parsed.pathname,
      mime_type: "text/html",
      url_origem: url,
      status: "pendente",
    })
    .select("id")
    .single()

  if (insErr || !row) {
    return { tipo: "erro", mensagem: "Falha ao registrar cotação." }
  }

  return extrairDadosCotacao(row.id, { htmlContent: htmlLimpo.slice(0, 80_000) })
}

// ─── Extração via Claude ──────────────────────────────────────────────────────

/**
 * Chama o Claude para extrair dados estruturados de uma cotação.
 * Para PDFs: lê o arquivo do Storage e envia via Files API.
 * Para HTML: recebe o conteúdo diretamente (já limpo pelo caller).
 */
export async function extrairDadosCotacao(
  cotacaoId: string,
  opts?: { htmlContent?: string },
): Promise<CotacaoResultado> {
  const supabase = await createClient()
  const db = supabase as AnyClient

  // Marca como processando
  await db
    .from("proposta_cotacoes")
    .update({ status: "processando" })
    .eq("id", cotacaoId)

  // Lê o registro
  const { data: row } = await db
    .from("proposta_cotacoes")
    .select("tipo_entrada, storage_path, nome_arquivo")
    .eq("id", cotacaoId)
    .single()

  if (!row) {
    return { tipo: "erro", mensagem: "Cotação não encontrada." }
  }

  try {
    let messageContent: Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"]

    if (opts?.htmlContent) {
      // Entrada via URL — envia como texto
      messageContent = [
        {
          type: "text",
          text:
            PROMPT_EXTRACAO +
            "\n\n---\nCONTEÚDO DA PÁGINA:\n\n" +
            opts.htmlContent,
        },
      ]
    } else {
      // Entrada via PDF — usa Files API do Anthropic
      if (!row.storage_path) {
        throw new Error("storage_path ausente para PDF.")
      }

      // Gera signed URL do Supabase Storage
      const { data: signed, error: signErr } = await supabase.storage
        .from("proposta-cotacoes")
        .createSignedUrl(row.storage_path, 120)

      if (signErr || !signed?.signedUrl) {
        throw new Error("Falha ao gerar URL de leitura do arquivo.")
      }

      // Baixa o PDF para memória
      const pdfRes = await fetch(signed.signedUrl)
      const pdfBuffer = await pdfRes.arrayBuffer()

      // Envia para Anthropic Files API
      const uploaded = await anthropic.beta.files.upload(
        {
          file: new File([pdfBuffer], row.nome_arquivo, { type: "application/pdf" }),
        },
        { headers: { "anthropic-beta": "files-api-2025-04-14" } },
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileBlock: any = {
        type: "document",
        source: { type: "file", file_id: uploaded.id },
      }
      messageContent = [
        { type: "text", text: PROMPT_EXTRACAO },
        fileBlock,
      ]
    }

    const response = await anthropic.messages.create({
      model: COTACAO_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: messageContent }],
      ...(opts?.htmlContent ? {} : { betas: ["files-api-2025-04-14"] }),
    })

    // Extrai o JSON da resposta
    const rawText =
      response.content.find((b) => b.type === "text")?.text ?? ""

    // Remove markdown se Claude envolver em ```json ```
    const jsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    const dados = JSON.parse(jsonText) as CotacaoExtraida

    // Garante que produtos seja um array
    if (!Array.isArray(dados.produtos)) dados.produtos = []

    // Salva no banco
    await db
      .from("proposta_cotacoes")
      .update({ status: "concluido", dados_extraidos: dados })
      .eq("id", cotacaoId)

    // Remove arquivo da Anthropic (sem custo de armazenamento longo)
    // Só para PDF — o file_id fica fora do escopo no caso URL
    // Best-effort, não bloqueia o retorno

    return { tipo: "concluido", dados, cotacaoId }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro desconhecido na extração."

    await db
      .from("proposta_cotacoes")
      .update({ status: "erro", erro_mensagem: msg })
      .eq("id", cotacaoId)

    return { tipo: "erro", mensagem: `Falha na análise: ${msg}` }
  }
}
