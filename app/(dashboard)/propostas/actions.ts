"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"

// Tabelas novas (propostas, proposta_produtos) ainda não estão nos tipos gerados.
// Após aplicar a migration e rodar `supabase gen types`, remover estes helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type PropostaStatus = "rascunho" | "enviada" | "aceita" | "recusada" | "expirada"

export type DadosNovaProposta = {
  clientes: { id: string; nome: string; email: string | null; empresa_id: string }[]
  tiposProduto: { id: string; nome: string }[]
  fornecedores: { id: string; nome: string }[]
  empresas: { id: string; nome: string; slug: string }[]
}

export type ProdutoPayload = {
  ordem: number
  tipoProdutoId: string | null
  tipoProdutoNome: string
  fornecedorId: string | null
  fornecedorNome: string | null
  descricao: string | null
  destino: string | null
  dataInicio: string | null
  dataFim: string | null
  pax: number
  valorVenda: number
  observacoes: string | null
}

export type CriarPropostaPayload = {
  empresaId: string
  clienteId: string | null
  clienteNome: string | null
  clienteEmail: string | null
  clienteTelefone: string | null
  dataProposta: string
  validade: string | null
  origem: string | null
  destino: string | null
  observacoes: string | null
  produtos: ProdutoPayload[]
}

export type PropostaParaPDF = {
  id: string
  identificador: string
  status: PropostaStatus
  dataProposta: string
  validade: string | null
  origem: string | null
  destino: string | null
  observacoes: string | null
  valorTotal: number
  empresaNome: string
  empresaSlug: string
  empresaCorPrimaria: string
  empresaLogoPath: string | null
  agenteNome: string
  clienteNome: string
  clienteEmail: string | null
  clienteTelefone: string | null
  produtos: {
    ordem: number
    tipoNome: string
    fornecedorNome: string | null
    descricao: string | null
    destino: string | null
    dataInicio: string | null
    dataFim: string | null
    pax: number
    valorVenda: number
    observacoes: string | null
  }[]
}

// ─── getDadosNovaProposta ─────────────────────────────────────────────────────

export async function getDadosNovaProposta(): Promise<ActionResult<DadosNovaProposta>> {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "criar")) {
    return { ok: false, error: "Sem permissão para criar propostas." }
  }

  const supabase = await createClient()
  const empresaIds = user.empresas.map((e) => e.id)

  const [clientesRes, tiposRes, fornecedoresRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, email, empresa_id")
      .in("empresa_id", empresaIds)
      .in("status", ["ativo", "lead"])
      .order("nome"),
    supabase
      .from("tipos_produto")
      .select("id, nome")
      .order("nome"),
    supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
  ])

  return {
    ok: true,
    data: {
      clientes: clientesRes.data ?? [],
      tiposProduto: tiposRes.data ?? [],
      fornecedores: fornecedoresRes.data ?? [],
      empresas: user.empresas,
    },
  }
}

// ─── criarProposta ────────────────────────────────────────────────────────────

export async function criarProposta(
  payload: CriarPropostaPayload,
): Promise<ActionResult<{ id: string; identificador: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "criar")) {
    return { ok: false, error: "Sem permissão para criar propostas." }
  }

  if (!payload.produtos || payload.produtos.length === 0) {
    return { ok: false, error: "A proposta deve ter ao menos um produto." }
  }

  const supabase = await createClient()
  const db = supabase as AnyClient

  // Gera identificador via função SQL (thread-safe)
  const { data: idData, error: idError } = await db
    .rpc("gerar_identificador_proposta", { p_empresa_id: payload.empresaId })

  if (idError || !idData) {
    return { ok: false, error: "Erro ao gerar identificador da proposta." }
  }

  const valorTotal = payload.produtos.reduce((sum, p) => sum + (p.valorVenda ?? 0), 0)

  const { data: proposta, error: propostaError } = await db
    .from("propostas")
    .insert({
      identificador: idData as string,
      empresa_id: payload.empresaId,
      usuario_id: user.id,
      cliente_id: payload.clienteId || null,
      cliente_nome: payload.clienteNome || null,
      cliente_email: payload.clienteEmail || null,
      cliente_telefone: payload.clienteTelefone || null,
      data_proposta: payload.dataProposta,
      validade: payload.validade || null,
      origem: payload.origem || null,
      destino: payload.destino || null,
      observacoes: payload.observacoes || null,
      valor_total: valorTotal,
    })
    .select("id, identificador")
    .single()

  if (propostaError || !proposta) {
    return { ok: false, error: propostaError?.message ?? "Erro ao criar proposta." }
  }

  if (payload.produtos.length > 0) {
    const { error: prodError } = await db.from("proposta_produtos").insert(
      payload.produtos.map((p) => ({
        proposta_id: proposta.id,
        ordem: p.ordem,
        tipo_produto_id: p.tipoProdutoId || null,
        tipo_produto_nome: p.tipoProdutoNome,
        fornecedor_id: p.fornecedorId || null,
        fornecedor_nome: p.fornecedorNome || null,
        descricao: p.descricao || null,
        destino: p.destino || null,
        data_inicio: p.dataInicio || null,
        data_fim: p.dataFim || null,
        pax: p.pax,
        valor_venda: p.valorVenda,
        observacoes: p.observacoes || null,
      })),
    )

    if (prodError) {
      // Rollback — remove proposta órfã
      await db.from("propostas").delete().eq("id", proposta.id)
      return { ok: false, error: "Erro ao salvar produtos da proposta." }
    }
  }

  revalidatePath("/propostas")
  return { ok: true, data: { id: proposta.id, identificador: idData as string } }
}

// ─── editarProposta ───────────────────────────────────────────────────────────

export async function editarProposta(
  id: string,
  payload: CriarPropostaPayload,
): Promise<ActionResult<void>> {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "editar")) {
    return { ok: false, error: "Sem permissão para editar propostas." }
  }

  if (!payload.produtos || payload.produtos.length === 0) {
    return { ok: false, error: "A proposta deve ter ao menos um produto." }
  }

  const supabase = await createClient()
  const db = supabase as AnyClient
  const valorTotal = payload.produtos.reduce((sum, p) => sum + (p.valorVenda ?? 0), 0)

  const { error: propostaError } = await db
    .from("propostas")
    .update({
      cliente_id: payload.clienteId || null,
      cliente_nome: payload.clienteNome || null,
      cliente_email: payload.clienteEmail || null,
      cliente_telefone: payload.clienteTelefone || null,
      data_proposta: payload.dataProposta,
      validade: payload.validade || null,
      origem: payload.origem || null,
      destino: payload.destino || null,
      observacoes: payload.observacoes || null,
      valor_total: valorTotal,
    })
    .eq("id", id)

  if (propostaError) {
    return { ok: false, error: propostaError.message }
  }

  // Recria produtos (delete + insert é mais simples que diff)
  await db.from("proposta_produtos").delete().eq("proposta_id", id)

  const { error: prodError } = await db.from("proposta_produtos").insert(
    payload.produtos.map((p) => ({
      proposta_id: id,
      ordem: p.ordem,
      tipo_produto_id: p.tipoProdutoId || null,
      tipo_produto_nome: p.tipoProdutoNome,
      fornecedor_id: p.fornecedorId || null,
      fornecedor_nome: p.fornecedorNome || null,
      descricao: p.descricao || null,
      destino: p.destino || null,
      data_inicio: p.dataInicio || null,
      data_fim: p.dataFim || null,
      pax: p.pax,
      valor_venda: p.valorVenda,
      observacoes: p.observacoes || null,
    })),
  )

  if (prodError) {
    return { ok: false, error: "Erro ao atualizar produtos da proposta." }
  }

  revalidatePath("/propostas")
  return { ok: true, data: undefined }
}

// ─── atualizarStatusProposta ──────────────────────────────────────────────────

export async function atualizarStatusProposta(
  id: string,
  status: PropostaStatus,
): Promise<ActionResult<void>> {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "editar")) {
    return { ok: false, error: "Sem permissão para alterar o status da proposta." }
  }

  const supabase = await createClient()
  const db = supabase as AnyClient

  const { error } = await db
    .from("propostas")
    .update({ status })
    .eq("id", id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/propostas")
  return { ok: true, data: undefined }
}

// ─── excluirProposta ──────────────────────────────────────────────────────────

export async function excluirProposta(id: string): Promise<ActionResult<void>> {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "excluir")) {
    return { ok: false, error: "Sem permissão para excluir propostas." }
  }

  const supabase = await createClient()
  const db = supabase as AnyClient

  const { error } = await db.from("propostas").delete().eq("id", id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/propostas")
  return { ok: true, data: undefined }
}

// ─── getPropostaParaPDF ───────────────────────────────────────────────────────

export async function getPropostaParaPDF(
  id: string,
): Promise<ActionResult<PropostaParaPDF>> {
  const user = await requireCurrentUser()
  if (!can(user, "propostas", "ler")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()
  const db = supabase as AnyClient

  const { data, error } = await db
    .from("propostas")
    .select(`
      id, identificador, status, data_proposta, validade, origem, destino,
      observacoes, valor_total,
      cliente_nome, cliente_email, cliente_telefone,
      empresa:empresas(nome, slug, cor_primaria, logo_path),
      agente:usuarios!propostas_usuario_id_fkey(nome),
      cliente:clientes(nome, email, telefone),
      produtos:proposta_produtos(
        ordem, tipo_produto_nome, fornecedor_nome, descricao,
        destino, data_inicio, data_fim, pax, valor_venda, observacoes
      )
    `)
    .eq("id", id)
    .single()

  if (error || !data) {
    return { ok: false, error: "Proposta não encontrada." }
  }

  type EmpresaRow = { nome: string; slug: string; cor_primaria: string | null; logo_path: string | null } | null
  type AgenteRow = { nome: string } | null
  type ClienteRow = { nome: string; email: string; telefone: string } | null

  const empresa = (Array.isArray(data.empresa) ? data.empresa[0] : data.empresa) as EmpresaRow
  const agente = (Array.isArray(data.agente) ? data.agente[0] : data.agente) as AgenteRow
  const clienteRecord = (Array.isArray(data.cliente) ? data.cliente[0] : data.cliente) as ClienteRow

  const clienteNome = clienteRecord?.nome ?? data.cliente_nome ?? "—"
  const clienteEmail = clienteRecord?.email ?? data.cliente_email ?? null
  const clienteTelefone = clienteRecord?.telefone ?? data.cliente_telefone ?? null

  const produtos = ((data.produtos ?? []) as {
    ordem: number
    tipo_produto_nome: string
    fornecedor_nome: string | null
    descricao: string | null
    destino: string | null
    data_inicio: string | null
    data_fim: string | null
    pax: number
    valor_venda: number
    observacoes: string | null
  }[])
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => ({
      ordem: p.ordem,
      tipoNome: p.tipo_produto_nome,
      fornecedorNome: p.fornecedor_nome,
      descricao: p.descricao,
      destino: p.destino,
      dataInicio: p.data_inicio,
      dataFim: p.data_fim,
      pax: p.pax,
      valorVenda: Number(p.valor_venda),
      observacoes: p.observacoes,
    }))

  return {
    ok: true,
    data: {
      id: data.id,
      identificador: data.identificador,
      status: data.status as PropostaStatus,
      dataProposta: data.data_proposta,
      validade: data.validade,
      origem: data.origem ?? null,
      destino: data.destino,
      observacoes: data.observacoes,
      valorTotal: Number(data.valor_total),
      empresaNome: empresa?.nome ?? "Magic Trips",
      empresaSlug: empresa?.slug ?? "magic-trips",
      empresaCorPrimaria: empresa?.cor_primaria ?? "#1498D5",
      empresaLogoPath: empresa?.logo_path ?? null,
      agenteNome: agente?.nome ?? "—",
      clienteNome,
      clienteEmail,
      clienteTelefone,
      produtos,
    },
  }
}
