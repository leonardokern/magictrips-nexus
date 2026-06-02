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
 *  E Detalhamento    → "identificador · localizadores"
 *  F Valor da Venda  → soma de valor_venda
 *  G RAV BRUTO       → soma de rav + rav_extra_cliente + rav_extra_fornecedor
 *  H % RAV Vendedor  → comissao_percentual
 *  I Comissão Venda. → G × H (formula)
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
        valor_venda, rav, rav_extra_cliente, rav_extra_fornecedor,
        fornecedor_nome, localizador, localizador_fornecedor, destino
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

    // Detalhamento: identificador + localizadores distintos + destino
    const localizadores = produtos
      .map((p) =>
        [p.localizador, p.localizador_fornecedor]
          .filter(Boolean)
          .join(" · "),
      )
      .filter(Boolean)
    const destinos = Array.from(
      new Set(produtos.map((p) => (p.destino ?? "").trim()).filter(Boolean)),
    )
    const partes = [v.identificador, ...localizadores, ...destinos].filter(Boolean)
    const detalhamento = partes.join(" - ")

    // Vendedora — só o primeiro nome, mantém estilo do modelo
    const nomeAgente = (agenteObj && !Array.isArray(agenteObj) && agenteObj.nome) || ""
    const vendedora = nomeAgente.split(" ")[0]?.toUpperCase() ?? ""

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
