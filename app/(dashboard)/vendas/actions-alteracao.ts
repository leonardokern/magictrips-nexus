"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { vendaAlteracaoCreateSchema } from "@/lib/schemas/venda"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

function flatten(errors: Record<string, string[] | undefined>) {
  const out: Record<string, string> = {}
  for (const [k, msgs] of Object.entries(errors)) {
    if (msgs && msgs.length > 0 && msgs[0]) out[k] = msgs[0]
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Listagem de vendas elegíveis para alteração (combobox/picker)
// ─────────────────────────────────────────────────────────────────────────────

export type VendaParaAlteracao = {
  id: string
  identificador: string
  data_venda: string
  empresa_id: string
  empresa_nome: string
  cliente_id: string
  cliente_nome: string
  valor_total: number
}

/**
 * Lista vendas aprovadas (tipo `original`) elegíveis para alteração,
 * respeitando o escopo de empresas do usuário e um termo de busca opcional
 * (identificador OR nome do cliente).
 *
 * Filtros explícitos:
 *   - status = 'aprovado'
 *   - tipo_venda = 'original' (nunca permite alteração de alteração)
 *   - empresa do usuário
 *
 * Limita a 20 resultados — o combobox é busca-e-seleção, não listagem completa.
 */
export async function listarVendasParaAlteracao(
  termo: string,
): Promise<ActionResult<VendaParaAlteracao[]>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  const termoTrim = termo.trim()

  // Quando há termo, busca clientes que dão match por nome — usamos os IDs
  // num OR no filtro de vendas (mesmo padrão de app/(dashboard)/vendas/page.tsx).
  let clienteIds: string[] = []
  if (termoTrim) {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nome", `%${termoTrim}%`)
      .limit(50)
    clienteIds = (clientes ?? []).map((c) => c.id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("vendas")
    .select(
      `
      id, identificador, data_venda, empresa_id, cliente_id, tipo_venda, status,
      empresa:empresas(nome),
      cliente:clientes(nome),
      produtos:venda_produtos(valor_venda)
      `,
    )
    .eq("status", "aprovado")
    .eq("tipo_venda", "original")
    .order("data_venda", { ascending: false })
    .limit(20)

  if (termoTrim) {
    if (clienteIds.length > 0) {
      q = q.or(
        `identificador.ilike.%${termoTrim}%,cliente_id.in.(${clienteIds.join(",")})`,
      )
    } else {
      q = q.ilike("identificador", `%${termoTrim}%`)
    }
  }

  const { data, error } = await q
  if (error) return { ok: false, error: error.message }

  type Row = {
    id: string
    identificador: string
    data_venda: string
    empresa_id: string
    cliente_id: string
    empresa: { nome: string } | null
    cliente: { nome: string } | null
    produtos: { valor_venda: number | string | null }[] | null
  }

  const rows = (data ?? []) as Row[]
  const out: VendaParaAlteracao[] = rows.map((v) => ({
    id: v.id,
    identificador: v.identificador,
    data_venda: v.data_venda,
    empresa_id: v.empresa_id,
    empresa_nome: v.empresa?.nome ?? "—",
    cliente_id: v.cliente_id,
    cliente_nome: v.cliente?.nome ?? "—",
    valor_total: (v.produtos ?? []).reduce(
      (acc, p) => acc + Number(p.valor_venda ?? 0),
      0,
    ),
  }))

  return { ok: true, data: out }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados completos da venda original — pra hidratar o wizard de alteração
// ─────────────────────────────────────────────────────────────────────────────

/** Shape do RPC `obter_venda_para_alteracao` — JSON pré-formatado. */
export type VendaOriginalCompleta = {
  id: string
  identificador: string
  empresa_id: string
  cliente_id: string
  usuario_id: string
  data_venda: string
  pax: number
  origem: string | null
  observacoes: string | null
  indicacao_percentual: number | null
  comissao_percentual: number | null
  status: string
  cliente: {
    id: string
    nome: string
    tipo_pessoa: string | null
    cpf: string | null
    cnpj: string | null
    razao_social: string | null
    nome_fantasia: string | null
    email: string | null
    telefone: string | null
  }
  agente: {
    id: string
    nome: string
  }
  produtos: Array<{
    id: string
    ordem: number
    tipo_produto_id: string
    tipo_produto_nome: string
    fornecedor_id: string | null
    fornecedor_nome: string
    localizador: string | null
    localizador_fornecedor: string | null
    destino: string | null
    data_emissao: string | null
    data_inicio_viagem: string | null
    data_fim_viagem: string | null
    valores_extras: Record<string, unknown>
    tipo_comissao: string | null
    valor_venda: number
    valor_custo: number
    rav: number | null
    rav_extra_cliente: number
    rav_extra_fornecedor: number
    comissao_vendedor: number | null
    pgto_modo: string
    pgto_forma: string | null
    pgto_cartao_id: string | null
    pgto_valor_total: number | null
    pgto_entrada: number
    pgto_num_parcelas: number
    pgto_valor_parcela: number | null
    pgto_data_debito: string | null
    pgto_primeira_parcela_extra: number
  }>
  passageiros: Array<{
    id: string
    ordem: number
    nome: string
    cpf: string | null
    data_nascimento: string | null
    passaporte: string | null
  }>
  /** Cobrança do cliente — null se a venda não tem cobrança configurada. */
  cobranca: {
    id: string
    valor_total: number | string
    observacoes: string | null
    itens: Array<{
      id: string
      tipo: string
      valor_total: number | string
      num_parcelas: number
      valor_parcela: number | string | null
      plataforma_link: string | null
      plataforma: string | null
      parcelas_detalhe: Array<{
        ordem: number
        valor: number | string
        data: string | null
      }> | null
      taxa_adquirente: number | string | null
      valor_liquido: number | string | null
      data_inicio: string | null
      data_primeiro_recebimento: string | null
      fornecedor_destino: string | null
      observacoes: string | null
    }>
  } | null
}

export async function obterVendaParaAlteracao(
  vendaId: string,
): Promise<ActionResult<VendaOriginalCompleta>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("obter_venda_para_alteracao", {
    p_venda_id: vendaId,
  })

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Venda não encontrada." }

  return { ok: true, data: data as unknown as VendaOriginalCompleta }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de produto disponíveis no sistema (para o seletor de "Adicionar")
// ─────────────────────────────────────────────────────────────────────────────

export type TipoProdutoOption = {
  id: string
  nome: string
  icone: string | null
}

export async function listarTiposProduto(): Promise<
  ActionResult<TipoProdutoOption[]>
> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tipos_produto")
    .select("id, nome, icone")
    .eq("ativo", true)
    .order("nome")

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: (data ?? []).map((t) => ({
      id: t.id,
      nome: t.nome,
      icone: t.icone ?? null,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados para recalcular comissão quando origem/cliente mudam
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload usado pelo modal de alteração pra permitir troca de cliente +
 * origem. As regras de comissão (mesma hierarquia do wizard) viajam
 * juntas pro front pra que a comissão seja recalculada localmente — e
 * aí enviada explícita no payload final do RPC.
 */
export type DadosAlteracao = {
  /** Clientes da MESMA empresa da venda original (limit 200 mais recentes). */
  clientes: {
    id: string
    nome: string
    cpf: string | null
    cnpj: string | null
    tipo_pessoa: "fisica" | "juridica"
  }[]
  /** Origens cadastradas (todas — não dependem da empresa pra listar). */
  origens: { id: string; nome: string; comissao_percentual: number | null }[]
  /** Regras de comissão por empresa+origem aplicáveis à empresa da venda. */
  comissoesRegras: { origem_id: string; percentual: number }[]
  /** Regras por perfil+origem (qualquer perfil). */
  perfisComissoes: { perfil_id: string; origem_id: string; percentual: number }[]
  /** Agente da venda original (pra rodar a hierarquia de comissão). */
  agente: {
    id: string
    perfil_id: string | null
    comissao_percentual: number | null
  } | null
}

export async function getDadosAlteracao(
  vendaOriginalId: string,
): Promise<ActionResult<DadosAlteracao>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()

  // Carrega a venda original só pra saber empresa_id + agente_id
  const { data: venda } = await supabase
    .from("vendas")
    .select("empresa_id, usuario_id")
    .eq("id", vendaOriginalId)
    .maybeSingle()
  if (!venda) return { ok: false, error: "Venda não encontrada." }

  const [
    { data: clientes },
    { data: origens },
    { data: comissoesRegras },
    { data: perfisComissoes },
    { data: agente },
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, cnpj, tipo_pessoa")
      .eq("empresa_id", venda.empresa_id)
      .order("nome")
      .limit(200),
    supabase.from("origens_venda").select("id, nome, comissao_percentual").order("nome"),
    supabase
      .from("comissoes_regras")
      .select("origem_id, percentual")
      .eq("empresa_id", venda.empresa_id),
    supabase.from("perfis_comissoes").select("perfil_id, origem_id, percentual"),
    supabase
      .from("usuarios")
      .select("id, perfil_id, comissao_percentual")
      .eq("id", venda.usuario_id)
      .maybeSingle(),
  ])

  return {
    ok: true,
    data: {
      clientes: (clientes ?? []) as DadosAlteracao["clientes"],
      origens: (origens ?? []) as DadosAlteracao["origens"],
      comissoesRegras: (comissoesRegras ?? []) as DadosAlteracao["comissoesRegras"],
      perfisComissoes: (perfisComissoes ?? []) as DadosAlteracao["perfisComissoes"],
      agente: agente as DadosAlteracao["agente"],
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Criar alteração de venda
// ─────────────────────────────────────────────────────────────────────────────

export async function criarAlteracaoVenda(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão para criar alterações." }
  }

  const parsed = vendaAlteracaoCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { data: vendaId, error } = await supabase.rpc("criar_alteracao_venda", {
    p_payload: JSON.parse(JSON.stringify(parsed.data)),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/vendas")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: vendaId as unknown as string } }
}
