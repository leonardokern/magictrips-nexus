import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Builder de dados do relatório "Vendas por Tipo de Produto".
 *
 * Uma linha por PRODUTO de venda (venda_produtos) do tipo selecionado,
 * dentro do intervalo de datas (data_venda da venda-mãe), considerando
 * apenas vendas `aprovado`. RLS garante o recorte por empresa/agente —
 * o builder recebe um client server-side já autenticado.
 *
 * Reutilizado pelas rotas de Excel e PDF pra não duplicar query/normalização.
 */

export type RelatorioTipoProdutoFiltros = {
  tipoProdutoId: string
  /** ISO YYYY-MM-DD (inclusivo) */
  dataInicio: string
  /** ISO YYYY-MM-DD (inclusivo) */
  dataFim: string
}

export type RelatorioTipoProdutoLinha = {
  vendaId: string
  identificador: string
  dataVenda: string // ISO
  empresa: string
  cliente: string
  vendedor: string
  fornecedor: string
  destino: string
  localizador: string
  dataInicioViagem: string // ISO ou ""
  dataFimViagem: string // ISO ou ""
  detalhes: string // campos extras concatenados
  valorVenda: number
  valorCusto: number
  rav: number
  ravExtraCliente: number
  ravExtraFornecedor: number
  /** rav + extra cliente + extra fornecedor */
  ravTotal: number
  /** Comissão do vendedor (valor já persistido na venda) */
  comissao: number
}

export type RelatorioTipoProdutoTotais = {
  qtdProdutos: number
  qtdVendas: number
  valorVenda: number
  valorCusto: number
  rav: number
  ravExtraCliente: number
  ravExtraFornecedor: number
  ravTotal: number
  comissao: number
  /** (ravTotal / valorVenda) × 100, ou null se sem venda */
  margemPercentual: number | null
}

export type RelatorioTipoProdutoDados = {
  tipoProdutoNome: string
  filtros: RelatorioTipoProdutoFiltros
  linhas: RelatorioTipoProdutoLinha[]
  totais: RelatorioTipoProdutoTotais
}

type NomeRel = { nome: string } | { nome: string }[] | null

type VendaRel = {
  id: string
  identificador: string | null
  data_venda: string | null
  empresa: NomeRel
  cliente: NomeRel
  agente: NomeRel
}

type ProdutoRow = {
  fornecedor_nome: string | null
  localizador: string | null
  destino: string | null
  data_inicio_viagem: string | null
  data_fim_viagem: string | null
  valores_extras: Record<string, unknown> | null
  valor_venda: number | null
  valor_custo: number | null
  rav: number | null
  rav_extra_cliente: number | null
  rav_extra_fornecedor: number | null
  comissao_vendedor: number | null
  venda: VendaRel | VendaRel[] | null
}

function umNome(rel: NomeRel): string {
  if (!rel) return ""
  const obj = Array.isArray(rel) ? rel[0] : rel
  return obj?.nome ?? ""
}

function umaVenda(rel: VendaRel | VendaRel[] | null): VendaRel | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

export async function buildRelatorioTipoProduto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  filtros: RelatorioTipoProdutoFiltros,
): Promise<
  | { ok: true; data: RelatorioTipoProdutoDados }
  | { ok: false; error: string }
> {
  const { tipoProdutoId, dataInicio, dataFim } = filtros

  // Nome do tipo (pro cabeçalho do relatório).
  const { data: tipo } = await supabase
    .from("tipos_produto")
    .select("nome")
    .eq("id", tipoProdutoId)
    .maybeSingle()

  const { data, error } = await supabase
    .from("venda_produtos")
    .select(
      `
      fornecedor_nome, localizador, destino,
      data_inicio_viagem, data_fim_viagem, valores_extras,
      valor_venda, valor_custo, rav, rav_extra_cliente, rav_extra_fornecedor,
      comissao_vendedor,
      venda:vendas!inner(
        id, identificador, data_venda, status,
        empresa:empresas(nome),
        cliente:clientes(nome),
        agente:usuarios!vendas_usuario_id_fkey(nome)
      )
    `,
    )
    .eq("tipo_produto_id", tipoProdutoId)
    .eq("venda.status", "aprovado")
    .gte("venda.data_venda", dataInicio)
    .lte("venda.data_venda", dataFim)

  if (error) return { ok: false, error: error.message }

  // Resolve UUIDs de campos `fornecedor` em valores_extras → nome.
  const [{ data: fornecedoresAll }, { data: camposFornecedorAll }] =
    await Promise.all([
      supabase.from("fornecedores").select("id, nome"),
      supabase.from("campos_extra").select("id").eq("tipo_campo", "fornecedor"),
    ])
  const fornecedorNomeById = new Map(
    (fornecedoresAll ?? []).map((f) => [f.id as string, f.nome as string]),
  )
  const campoFornecedorIds = new Set(
    (camposFornecedorAll ?? []).map((c) => c.id as string),
  )

  function descreverExtras(extras: Record<string, unknown> | null): string {
    if (!extras) return ""
    const valores: string[] = []
    for (const [campoId, raw] of Object.entries(extras)) {
      if (raw == null) continue
      let txt = String(raw).trim()
      if (!txt) continue
      if (campoFornecedorIds.has(campoId) && fornecedorNomeById.has(txt)) {
        txt = fornecedorNomeById.get(txt) ?? txt
      }
      valores.push(txt)
    }
    return valores.join(", ")
  }

  const rows = (data as unknown as ProdutoRow[] | null) ?? []

  const linhas: RelatorioTipoProdutoLinha[] = rows.map((p) => {
    const venda = umaVenda(p.venda)
    const rav = Number(p.rav ?? 0)
    const ravExtraCliente = Number(p.rav_extra_cliente ?? 0)
    const ravExtraFornecedor = Number(p.rav_extra_fornecedor ?? 0)
    return {
      vendaId: venda?.id ?? "",
      identificador: venda?.identificador ?? "",
      dataVenda: venda?.data_venda ?? "",
      empresa: umNome(venda?.empresa ?? null),
      cliente: umNome(venda?.cliente ?? null),
      vendedor: umNome(venda?.agente ?? null),
      fornecedor: (p.fornecedor_nome ?? "").trim(),
      destino: (p.destino ?? "").trim(),
      localizador: (p.localizador ?? "").trim(),
      dataInicioViagem: p.data_inicio_viagem ?? "",
      dataFimViagem: p.data_fim_viagem ?? "",
      detalhes: descreverExtras(p.valores_extras),
      valorVenda: Number(p.valor_venda ?? 0),
      valorCusto: Number(p.valor_custo ?? 0),
      rav,
      ravExtraCliente,
      ravExtraFornecedor,
      ravTotal: rav + ravExtraCliente + ravExtraFornecedor,
      comissao: Number(p.comissao_vendedor ?? 0),
    }
  })

  // Ordena por data da venda (asc) e depois identificador.
  linhas.sort((a, b) => {
    if (a.dataVenda !== b.dataVenda) return a.dataVenda < b.dataVenda ? -1 : 1
    return a.identificador.localeCompare(b.identificador)
  })

  const totais: RelatorioTipoProdutoTotais = {
    qtdProdutos: linhas.length,
    qtdVendas: new Set(linhas.map((l) => l.vendaId)).size,
    valorVenda: linhas.reduce((a, l) => a + l.valorVenda, 0),
    valorCusto: linhas.reduce((a, l) => a + l.valorCusto, 0),
    rav: linhas.reduce((a, l) => a + l.rav, 0),
    ravExtraCliente: linhas.reduce((a, l) => a + l.ravExtraCliente, 0),
    ravExtraFornecedor: linhas.reduce((a, l) => a + l.ravExtraFornecedor, 0),
    ravTotal: linhas.reduce((a, l) => a + l.ravTotal, 0),
    comissao: linhas.reduce((a, l) => a + l.comissao, 0),
    margemPercentual: null,
  }
  totais.margemPercentual =
    totais.valorVenda > 0 ? (totais.ravTotal / totais.valorVenda) * 100 : null

  return {
    ok: true,
    data: {
      tipoProdutoNome: tipo?.nome ?? "Tipo de produto",
      filtros,
      linhas,
      totais,
    },
  }
}
