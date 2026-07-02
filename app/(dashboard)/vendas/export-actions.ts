"use server"

import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"

/**
 * Linha individual da planilha — corresponde a uma venda completa.
 * O modelo da Magic Trips lista uma linha por venda (não por produto).
 * Quando uma venda tem múltiplos produtos, somamos os valores.
 *
 * Colunas mapeadas pro modelo:
 *  A data            → data_venda
 *  B Cliente         → cliente.nome
 *  C Fornecedor      → primeiro fornecedor distinto (ou "Vários" se >1)
 *  D Vendedora       → primeiro nome do agente
 *  E ID Nexus        → identificador (ex: "MT-0007")
 *  F Detalhamento    → descrição dos produtos:
 *                       "Tipo: campo1, campo2; Tipo: campo1, ..."
 *  G Valor da Venda  → soma de valor_venda
 *  H RAV BRUTO       → soma de rav + rav_extra_cliente + rav_extra_fornecedor
 *  I % RAV Vendedor  → comissao_percentual
 *  J Comissão Venda. → H × I (formula)
 */
export type LinhaExport = {
  vendaId: string
  identificador: string
  dataVenda: string // ISO YYYY-MM-DD
  cliente: string
  fornecedor: string
  vendedora: string
  detalhamento: string
  valorVenda: number
  ravBruto: number
  comissaoPercentual: number
}

export type DadosExport = {
  /** Agrupado por mês "YYYY-MM" pra virar 1 aba por mês. */
  porMes: Record<string, LinhaExport[]>
}

type ProdutoRow = {
  valor_venda: number
  rav: number | null
  rav_extra_cliente: number | null
  rav_extra_fornecedor: number | null
  fornecedor_nome: string | null
  localizador: string | null
  localizador_fornecedor: string | null
  destino: string | null
  /** Snapshot do nome do tipo no momento da venda (ex: "Aéreo"). */
  tipo_produto_nome: string | null
  /** JSONB { <campo_id>: <valor_string> } — valores dos campos extras. */
  valores_extras: Record<string, unknown> | null
}

/**
 * Carrega dados de múltiplas vendas validadas pra exportação Excel.
 * Restrito a usuários com permissão `vendas.aprovar` (Admin/Gerente).
 */
export async function getVendasParaExportar(
  ids: string[],
): Promise<{ ok: true; data: DadosExport } | { ok: false; error: string }> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "aprovar")) {
    return { ok: false, error: "Sem permissão para exportar vendas." }
  }
  if (ids.length === 0) {
    return { ok: false, error: "Selecione ao menos uma venda." }
  }

  const supabase = await createClient()

  // Carrega todas as vendas + produtos + cliente + agente em uma query
  const { data, error } = await supabase
    .from("vendas")
    .select(
      `
      id, identificador, data_venda, status, comissao_percentual,
      cliente:clientes(nome),
      agente:usuarios!vendas_usuario_id_fkey(nome),
      produtos:venda_produtos(
        ordem,
        valor_venda, rav, rav_extra_cliente, rav_extra_fornecedor,
        fornecedor_nome, localizador, localizador_fornecedor, destino,
        tipo_produto_nome, valores_extras
      )
    `,
    )
    .in("id", ids)
    .eq("status", "aprovado")
    .order("data_venda", { ascending: true })

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: "Nenhuma venda aprovada encontrada." }
  }

  // Pré-carrega catálogo de fornecedores (id → nome) e campos extras de
  // tipo `fornecedor` pra resolver UUIDs em valores_extras de volta pro
  // nome do fornecedor — assim o Excel mostra "LATAM" em vez de um UUID.
  const [{ data: fornecedoresAll }, { data: camposFornecedorAll }] = await Promise.all([
    supabase.from("fornecedores").select("id, nome"),
    supabase.from("campos_extra").select("id").eq("tipo_campo", "fornecedor"),
  ])
  const fornecedorNomeById = new Map(
    (fornecedoresAll ?? []).map((f) => [f.id as string, f.nome as string]),
  )
  const campoFornecedorIds = new Set(
    (camposFornecedorAll ?? []).map((c) => c.id as string),
  )

  type ClienteRel = { nome: string } | { nome: string }[] | null
  type AgenteRel = { nome: string } | { nome: string }[] | null

  const porMes: Record<string, LinhaExport[]> = {}

  for (const v of data) {
    const clienteObj = Array.isArray(v.cliente) ? v.cliente[0] : (v.cliente as ClienteRel)
    const agenteObj = Array.isArray(v.agente) ? v.agente[0] : (v.agente as AgenteRel)
    const produtos = (v.produtos as ProdutoRow[] | null) ?? []

    // Soma valores
    const valorVenda = produtos.reduce((acc, p) => acc + Number(p.valor_venda ?? 0), 0)
    const ravBruto = produtos.reduce(
      (acc, p) =>
        acc +
        Number(p.rav ?? 0) +
        Number(p.rav_extra_cliente ?? 0) +
        Number(p.rav_extra_fornecedor ?? 0),
      0,
    )

    // Fornecedor único / "Vários"
    const fornecedoresUnicos = Array.from(
      new Set(produtos.map((p) => (p.fornecedor_nome ?? "").trim()).filter(Boolean)),
    )
    const fornecedor =
      fornecedoresUnicos.length === 0
        ? ""
        : fornecedoresUnicos.length === 1
          ? fornecedoresUnicos[0]!
          : "VÁRIOS"

    // Detalhamento: para cada produto, lista o tipo + valores dos campos
    // customizados separados por vírgula. Produtos separados por ponto-e-vírgula.
    //   Ex: "Aéreo: LATAM, CGH-SSA, LH7A2D; Hotel: Mar Hotel, 02/01..02/05"
    //
    // Valores são extraídos de `valores_extras` (jsonb). UUIDs de campos
    // tipo `fornecedor` são resolvidos pelo nome via fornecedorNomeById.
    function descreverProduto(p: ProdutoRow): string {
      const tipo = (p.tipo_produto_nome ?? "").trim()
      const extras = p.valores_extras ?? {}
      const valores: string[] = []
      for (const [chave, raw] of Object.entries(extras)) {
        if (raw == null) continue
        let txt = String(raw).trim()
        if (!txt) continue
        // Chave composta `campoId::itemId` em linhas de pacote.
        const campoId = chave.split("::")[0]!
        // Resolve UUID → nome se o campo é do tipo fornecedor.
        if (campoFornecedorIds.has(campoId) && fornecedorNomeById.has(txt)) {
          txt = fornecedorNomeById.get(txt) ?? txt
        }
        valores.push(txt)
      }
      if (!tipo && valores.length === 0) return ""
      if (!tipo) return valores.join(", ")
      if (valores.length === 0) return tipo
      return `${tipo}: ${valores.join(", ")}`
    }

    const detalhamento = produtos
      .map(descreverProduto)
      .filter(Boolean)
      .join("; ")

    // Vendedora — nome completo do agente
    const nomeAgente = (agenteObj && !Array.isArray(agenteObj) && agenteObj.nome) || ""
    const vendedora = nomeAgente.toUpperCase()

    const linha: LinhaExport = {
      vendaId: v.id,
      identificador: v.identificador ?? "",
      dataVenda: v.data_venda ?? "",
      cliente:
        ((clienteObj && !Array.isArray(clienteObj) && clienteObj.nome) || "—").toUpperCase(),
      fornecedor: fornecedor.toUpperCase(),
      vendedora,
      detalhamento,
      valorVenda,
      ravBruto,
      comissaoPercentual: Number(v.comissao_percentual ?? 0) / 100,
    }

    // Agrupa por mês YYYY-MM
    const chave = v.data_venda ? v.data_venda.slice(0, 7) : "0000-00"
    porMes[chave] = porMes[chave] ?? []
    porMes[chave].push(linha)
  }

  return { ok: true, data: { porMes } }
}
