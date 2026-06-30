import type { SupabaseClient } from "@supabase/supabase-js"

export type RelatorioComissaoFiltros = {
  /** ISO YYYY-MM-DD (inclusivo) */
  dataInicio: string
  /** ISO YYYY-MM-DD (inclusivo) */
  dataFim: string
}

export type RelatorioComissaoAgente = {
  usuarioId: string
  nomeAgente: string
  empresa: string
  qtdVendas: number
  qtdProdutos: number
  valorVenda: number
  /** rav + rav_extra_cliente (base de cálculo da comissão) */
  ravTotal: number
  comissao: number
  /** (comissao / valorVenda) × 100, ou null se sem vendas */
  percentualMedio: number | null
}

export type RelatorioComissaoTotais = {
  qtdAgentes: number
  qtdAgentesComVendas: number
  qtdVendas: number
  qtdProdutos: number
  valorVenda: number
  ravTotal: number
  comissao: number
}

export type RelatorioComissaoDados = {
  filtros: RelatorioComissaoFiltros
  agentes: RelatorioComissaoAgente[]
  totais: RelatorioComissaoTotais
}

type UsuarioRow = {
  id: string
  nome: string
  empresa: { nome: string } | { nome: string }[] | null
}

type ProdRow = {
  valor_venda: number | null
  rav: number | null
  rav_extra_cliente: number | null
  comissao_vendedor: number | null
  venda: { id: string; usuario_id: string } | { id: string; usuario_id: string }[] | null
}

function nomeEmpresa(rel: UsuarioRow["empresa"]): string {
  if (!rel) return ""
  return (Array.isArray(rel) ? rel[0] : rel)?.nome ?? ""
}

function umaVenda(rel: ProdRow["venda"]): { id: string; usuario_id: string } | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

export async function buildRelatorioComissao(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  filtros: RelatorioComissaoFiltros,
): Promise<{ ok: true; data: RelatorioComissaoDados } | { ok: false; error: string }> {
  const { dataInicio, dataFim } = filtros

  // Perfis com tipo 'agente'
  const { data: perfis, error: errPerfis } = await supabase
    .from("perfis_acesso")
    .select("id")
    .eq("tipo", "agente")

  if (errPerfis) return { ok: false, error: errPerfis.message }
  const perfilIds = (perfis ?? []).map((p: { id: string }) => p.id)

  // Produtos das vendas aprovadas no período → acumula por usuario_id
  const { data: produtos, error: errProdutos } = await supabase
    .from("venda_produtos")
    .select(
      `valor_venda, rav, rav_extra_cliente, comissao_vendedor,
       venda:vendas!inner(id, usuario_id, data_venda, status)`,
    )
    .eq("venda.status", "aprovado")
    .gte("venda.data_venda", dataInicio)
    .lte("venda.data_venda", dataFim)

  if (errProdutos) return { ok: false, error: errProdutos.message }

  type Acc = { vendaIds: Set<string>; qtdProdutos: number; valorVenda: number; ravTotal: number; comissao: number }
  const accumMap = new Map<string, Acc>()

  for (const p of (produtos ?? []) as ProdRow[]) {
    const venda = umaVenda(p.venda)
    if (!venda?.usuario_id) continue
    const uid = venda.usuario_id

    if (!accumMap.has(uid)) {
      accumMap.set(uid, { vendaIds: new Set(), qtdProdutos: 0, valorVenda: 0, ravTotal: 0, comissao: 0 })
    }
    const acc = accumMap.get(uid)!
    acc.vendaIds.add(venda.id)
    acc.qtdProdutos++
    acc.valorVenda += Number(p.valor_venda ?? 0)
    acc.ravTotal += Number(p.rav ?? 0) + Number(p.rav_extra_cliente ?? 0)
    acc.comissao += Number(p.comissao_vendedor ?? 0)
  }

  // Usuários do relatório: TODOS os agentes ativos (mesmo sem vendas) +
  // QUALQUER pessoa que vendeu no período (ex.: gerente que fez vendas e
  // ganhou comissão). Assim ninguém com comissão fica de fora e o total
  // bate com o dashboard ("vendas do período" = todas as vendas aprovadas).
  const { data: agentesAtivos, error: errUsuarios } = await supabase
    .from("usuarios")
    .select("id, nome, empresa:empresas(nome)")
    .eq("ativo", true)
    .in("perfil_id", perfilIds)

  if (errUsuarios) return { ok: false, error: errUsuarios.message }

  const idsAgentes = new Set((agentesAtivos ?? []).map((u: { id: string }) => u.id))
  const idsVendedoresExtra = [...accumMap.keys()].filter((id) => !idsAgentes.has(id))

  let vendedoresExtra: UsuarioRow[] = []
  if (idsVendedoresExtra.length > 0) {
    const { data: extra, error: errExtra } = await supabase
      .from("usuarios")
      .select("id, nome, empresa:empresas(nome)")
      .in("id", idsVendedoresExtra)
    if (errExtra) return { ok: false, error: errExtra.message }
    vendedoresExtra = (extra ?? []) as unknown as UsuarioRow[]
  }

  const usuarios: UsuarioRow[] = [
    ...((agentesAtivos ?? []) as unknown as UsuarioRow[]),
    ...vendedoresExtra,
  ].sort((a, b) => a.nome.localeCompare(b.nome))

  const agentes: RelatorioComissaoAgente[] = ((usuarios ?? []) as UsuarioRow[]).map((u) => {
    const acc = accumMap.get(u.id)
    const comissao = acc?.comissao ?? 0
    const valorVenda = acc?.valorVenda ?? 0
    return {
      usuarioId: u.id,
      nomeAgente: u.nome,
      empresa: nomeEmpresa(u.empresa),
      qtdVendas: acc?.vendaIds.size ?? 0,
      qtdProdutos: acc?.qtdProdutos ?? 0,
      valorVenda,
      ravTotal: acc?.ravTotal ?? 0,
      comissao,
      percentualMedio: valorVenda > 0 ? (comissao / valorVenda) * 100 : null,
    }
  })

  const totais: RelatorioComissaoTotais = {
    qtdAgentes: agentes.length,
    qtdAgentesComVendas: agentes.filter((a) => a.qtdVendas > 0).length,
    qtdVendas: agentes.reduce((s, a) => s + a.qtdVendas, 0),
    qtdProdutos: agentes.reduce((s, a) => s + a.qtdProdutos, 0),
    valorVenda: agentes.reduce((s, a) => s + a.valorVenda, 0),
    ravTotal: agentes.reduce((s, a) => s + a.ravTotal, 0),
    comissao: agentes.reduce((s, a) => s + a.comissao, 0),
  }

  return { ok: true, data: { filtros, agentes, totais } }
}
