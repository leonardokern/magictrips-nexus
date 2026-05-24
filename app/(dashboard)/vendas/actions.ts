"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import { vendaCreateSchema } from "@/lib/schemas/venda"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"

function flatten(errors: Record<string, string[] | undefined>) {
  const out: Record<string, string> = {}
  for (const [k, msgs] of Object.entries(errors)) {
    if (msgs && msgs.length > 0 && msgs[0]) out[k] = msgs[0]
  }
  return out
}

/**
 * Cria uma venda completa (status `pendente_validacao`) via RPC transacional.
 * A RPC `criar_venda_completa` no banco insere cliente novo (se necessário),
 * venda, produtos, passageiros, cobrança e os lembretes pros aprovadores.
 */
export async function criarVenda(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão para criar vendas." }
  }

  const parsed = vendaCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { data: vendaId, error } = await supabase.rpc(
    "criar_venda_completa",
    {
      // Cast pra Json — Supabase aceita objects/arrays serializáveis
      p_payload: JSON.parse(JSON.stringify(parsed.data)),
    },
  )

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  revalidatePath("/vendas")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: vendaId as unknown as string } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados pro modal de nova venda
// ─────────────────────────────────────────────────────────────────────────────

export type DadosNovaVenda = {
  empresas: { id: string; nome: string; slug: string }[]
  defaultEmpresaId: string | undefined
  clientes: {
    id: string
    nome: string
    cpf: string | null
    email: string | null
    empresa_id: string
  }[]
  fornecedores: { id: string; nome: string }[]
  cartoes: {
    id: string
    nome: string
    banco: string | null
    empresa_id: string
    dia_vencimento: number
  }[]
  origens: { id: string; nome: string; comissao_percentual: number | null }[]
  tiposProduto: {
    id: string
    nome: string
    icone: string | null
    campos: { campo_id: string; obrigatorio: boolean; ordem: number }[]
  }[]
  camposExtra: {
    id: string
    nome: string
    tipo_campo: string
    placeholder: string | null
    opcoes: { valor: string }[]
  }[]
  /** Regras padrão de comissão por empresa + origem (tabela comissoes_regras). */
  comissoesRegras: { empresa_id: string; origem_id: string; percentual: number }[]
  /** Overrides de comissão por perfil de acesso + origem (tabela perfis_comissoes). */
  perfisComissoes: { perfil_id: string; origem_id: string; percentual: number }[]
  usuariosAgentes: { id: string; nome: string; perfil_id: string; comissao_percentual: number | null }[]
  usuarioLogadoId: string
  podeTrocarAgente: boolean
}

/**
 * Aprova uma venda pendente, registrando o aprovador e o timestamp.
 * Requer permissão `vendas.aprovar`.
 */
export async function aprovarVenda(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "aprovar")) {
    return { ok: false, error: "Sem permissão para aprovar vendas." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("aprovar_venda", {
    p_venda_id: id,
    p_aprovador_id: user.id,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/vendas")
  revalidatePath(`/vendas/${id}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Devolve uma venda pendente para rascunho com um motivo de revisão.
 * Requer permissão `vendas.aprovar`.
 */
export async function solicitarRevisaoVenda(
  id: string,
  motivo: string,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "aprovar")) {
    return { ok: false, error: "Sem permissão para solicitar revisão." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("devolver_venda", {
    p_venda_id: id,
    p_revisor_id: user.id,
    p_motivo: motivo.trim(),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/vendas")
  revalidatePath(`/vendas/${id}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalhes de uma venda para o modal de visualização
// ─────────────────────────────────────────────────────────────────────────────

export type VendaDetalhes = {
  id: string
  identificador: string
  status: string
  empresaNome: string
  dataVenda: string
  dataInicioViagem: string | null
  dataFimViagem: string | null
  clienteNome: string
  agenteId: string
  agenteNome: string
  origem: string | null
  pax: number
  observacoes: string | null
  motivoRevisao: string | null
  aprovadoPorNome: string | null
  dataAprovacao: string | null
  /** Percentual de comissão do agente congelado no momento da venda. */
  comissaoPercentual: number | null
  produtos: {
    tipoNome: string
    icone: string | null
    valorVenda: number
    valorCusto: number
    rav: number
    ravExtraCliente: number
    ravExtraFornecedor: number
    comissao: number
    tipoComissao: string | null
    fornecedorNome: string
    localizador: string | null
    localizadorFornecedor: string | null
    destino: string | null
    dataInicio: string | null
    dataFim: string | null
    pgtoForma: string | null
    pgtoCartaoNome: string | null
    pgtoValorTotal: number | null
    pgtoEntrada: number
    pgtoNumParcelas: number
    pgtoValorParcela: number | null
    pgtoDataDebito: string | null
    /** Campos personalizados do tipo de produto resolvidos para { nome, valor }. */
    camposExtras: { nome: string; valor: string }[]
  }[]
  cobranca: {
    tipo: string
    valor: number
    parcelas: number
    valorParcela: number | null
    plataformaLink: string | null
    taxaAdquirente: number | null
    valorLiquido: number | null
    dataInicio: string | null
    dataPrimeiroRecebimento: string | null
    fornecedorDestino: string | null
    observacoes: string | null
  }[]
  passageiros: {
    nome: string
    cpf: string | null
    dataNascimento: string | null
  }[]
}

export async function getVendaDetalhes(
  id: string,
): Promise<ActionResult<VendaDetalhes>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "ler")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()

  const { data: v } = await supabase
    .from("vendas")
    .select(
      `
      id, identificador, status, data_venda, pax, origem, observacoes, motivo_revisao,
      empresa_id, usuario_id, aprovado_por, data_aprovacao,
      comissao_percentual,
      empresa:empresas(nome),
      cliente:clientes(nome),
      agente:usuarios!vendas_usuario_id_fkey(id, nome, comissao_percentual, perfil_id),
      aprovador:usuarios!vendas_aprovado_por_fkey(nome)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (!v) return { ok: false, error: "Venda não encontrada." }

  type AgenteCompleto = {
    id: string
    nome: string
    comissao_percentual: number | null
    perfil_id: string
  } | null
  type Simples = { nome: string } | null
  type TipoProduto = { icone: string | null } | null

  const agente = v.agente as AgenteCompleto

  // ── Comissão congelada no momento da venda ───────────────────────────────
  // Lê o valor armazenado em vendas.comissao_percentual (congelado na criação).
  // Para vendas antigas (null), faz lookup dinâmico pela hierarquia como fallback.
  let comissaoPercentual: number | null = v.comissao_percentual != null
    ? Number(v.comissao_percentual)
    : null

  if (comissaoPercentual === null) {
    // Fallback para vendas antigas sem o campo salvo — resolve pela hierarquia:
    // 1. Fixo por usuário (ex.: Jéssica 12%)
    // 2. Regra por perfil + origem (perfis_comissoes)
    // 3. Regra padrão por empresa + origem (comissoes_regras)
    if (agente?.comissao_percentual != null) {
      comissaoPercentual = Number(agente.comissao_percentual)
    } else {
      const nomeOrigem = v.origem
      if (nomeOrigem) {
        const { data: origemRow } = await supabase
          .from("origens_venda")
          .select("id, comissao_percentual")
          .eq("nome", nomeOrigem)
          .maybeSingle()

        if (origemRow) {
          if (agente?.perfil_id) {
            const { data: pc } = await supabase
              .from("perfis_comissoes")
              .select("percentual")
              .eq("perfil_id", agente.perfil_id)
              .eq("origem_id", origemRow.id)
              .maybeSingle()
            if (pc) comissaoPercentual = Number(pc.percentual)
          }

          if (comissaoPercentual === null && v.empresa_id) {
            const { data: cr } = await supabase
              .from("comissoes_regras")
              .select("percentual")
              .eq("empresa_id", v.empresa_id)
              .eq("origem_id", origemRow.id)
              .maybeSingle()
            if (cr) comissaoPercentual = Number(cr.percentual)
          }

          if (comissaoPercentual === null && origemRow.comissao_percentual != null) {
            comissaoPercentual = Number(origemRow.comissao_percentual)
          }
        }
      }
    }
  }

  const [{ data: produtos }, { data: passageiros }, { data: cobranca }, { data: camposExtraRows }] =
    await Promise.all([
      supabase
        .from("venda_produtos")
        .select(
          `tipo_produto_nome, valor_venda, valor_custo, rav, comissao_vendedor,
           rav_extra_cliente, rav_extra_fornecedor, tipo_comissao,
           fornecedor_nome, localizador, localizador_fornecedor, destino,
           data_inicio_viagem, data_fim_viagem, valores_extras,
           pgto_forma, pgto_valor_total, pgto_entrada, pgto_num_parcelas,
           pgto_valor_parcela, pgto_data_debito,
           cartao:cartoes!fk_venda_produtos_cartao(nome),
           tipo_produto:tipos_produto!venda_produtos_tipo_produto_id_fkey(icone)`,
        )
        .eq("venda_id", id)
        .order("ordem"),
      supabase
        .from("venda_passageiros")
        .select("nome, cpf, data_nascimento")
        .eq("venda_id", id)
        .order("ordem"),
      supabase
        .from("cobranca_cliente")
        .select(
          `itens:cobranca_cliente_itens(
            tipo, valor_total, num_parcelas, valor_parcela,
            plataforma_link, taxa_adquirente, valor_liquido,
            data_inicio, data_primeiro_recebimento,
            fornecedor_destino, observacoes
          )`,
        )
        .eq("venda_id", id)
        .maybeSingle(),
      supabase
        .from("campos_extra")
        .select("id, nome"),
    ])

  // Mapa de id → nome para campos personalizados
  const camposMap: Record<string, string> = {}
  for (const c of camposExtraRows ?? []) {
    camposMap[c.id] = c.nome
  }

  const dataInicio =
    (produtos ?? []).find((p) => p.data_inicio_viagem)?.data_inicio_viagem ??
    null
  const dataFim =
    (produtos ?? []).find((p) => p.data_fim_viagem)?.data_fim_viagem ?? null

  return {
    ok: true,
    data: {
      id: v.id,
      identificador: v.identificador,
      status: v.status,
      empresaNome: (v.empresa as Simples)?.nome ?? "—",
      dataVenda: v.data_venda,
      dataInicioViagem: dataInicio,
      dataFimViagem: dataFim,
      clienteNome: (v.cliente as Simples)?.nome ?? "—",
      agenteId: agente?.id ?? "",
      agenteNome: agente?.nome ?? "—",
      origem: v.origem,
      pax: v.pax,
      observacoes: v.observacoes,
      motivoRevisao: v.motivo_revisao,
      aprovadoPorNome: (v.aprovador as Simples)?.nome ?? null,
      dataAprovacao: v.data_aprovacao ? v.data_aprovacao.slice(0, 10) : null,
      comissaoPercentual,
      produtos: (produtos ?? []).map((p) => {
        const rav = Number(p.rav ?? 0)
        const stored = Number(p.comissao_vendedor ?? 0)
        const comissao =
          stored > 0
            ? stored
            : comissaoPercentual !== null && rav > 0
              ? Number(((rav * comissaoPercentual) / 100).toFixed(2))
              : 0

        // Resolve campos extras: { campo_id: valor } → [{ nome, valor }]
        const extras = p.valores_extras as Record<string, unknown> | null
        const camposExtras: { nome: string; valor: string }[] = []
        if (extras) {
          for (const [campoId, val] of Object.entries(extras)) {
            if (val === null || val === undefined || val === "") continue
            const nome = camposMap[campoId] ?? campoId
            camposExtras.push({ nome, valor: String(val) })
          }
        }

        type CartaoSimples = { nome: string } | null

        return {
          tipoNome: p.tipo_produto_nome,
          icone: (p.tipo_produto as unknown as TipoProduto)?.icone ?? null,
          valorVenda: Number(p.valor_venda ?? 0),
          valorCusto: Number(p.valor_custo ?? 0),
          rav,
          ravExtraCliente: Number(p.rav_extra_cliente ?? 0),
          ravExtraFornecedor: Number(p.rav_extra_fornecedor ?? 0),
          comissao,
          tipoComissao: p.tipo_comissao ?? null,
          fornecedorNome: p.fornecedor_nome ?? "",
          localizador: p.localizador ?? null,
          localizadorFornecedor: p.localizador_fornecedor ?? null,
          destino: p.destino ?? null,
          dataInicio: p.data_inicio_viagem ?? null,
          dataFim: p.data_fim_viagem ?? null,
          pgtoForma: p.pgto_forma ?? null,
          pgtoCartaoNome: (p.cartao as unknown as CartaoSimples)?.nome ?? null,
          pgtoValorTotal: p.pgto_valor_total != null ? Number(p.pgto_valor_total) : null,
          pgtoEntrada: Number(p.pgto_entrada ?? 0),
          pgtoNumParcelas: Number(p.pgto_num_parcelas ?? 1),
          pgtoValorParcela: p.pgto_valor_parcela != null ? Number(p.pgto_valor_parcela) : null,
          pgtoDataDebito: p.pgto_data_debito ?? null,
          camposExtras,
        }
      }),
      cobranca: (
        (
          cobranca?.itens as unknown as Array<{
            tipo: string
            valor_total: number
            num_parcelas: number
            valor_parcela: number | null
            plataforma_link: string | null
            taxa_adquirente: number | null
            valor_liquido: number | null
            data_inicio: string | null
            data_primeiro_recebimento: string | null
            fornecedor_destino: string | null
            observacoes: string | null
          }>
        ) ?? []
      ).map((it) => ({
        tipo: it.tipo,
        valor: Number(it.valor_total),
        parcelas: it.num_parcelas,
        valorParcela: it.valor_parcela != null ? Number(it.valor_parcela) : null,
        plataformaLink: it.plataforma_link ?? null,
        taxaAdquirente: it.taxa_adquirente != null ? Number(it.taxa_adquirente) : null,
        valorLiquido: it.valor_liquido != null ? Number(it.valor_liquido) : null,
        dataInicio: it.data_inicio ?? null,
        dataPrimeiroRecebimento: it.data_primeiro_recebimento ?? null,
        fornecedorDestino: it.fornecedor_destino ?? null,
        observacoes: it.observacoes ?? null,
      })),
      passageiros: (passageiros ?? []).map((p) => ({
        nome: p.nome,
        cpf: p.cpf ?? null,
        dataNascimento: p.data_nascimento ?? null,
      })),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados completos para geração de PDF
// ─────────────────────────────────────────────────────────────────────────────

export type VendaParaPDF = {
  id: string
  identificador: string
  status: string
  dataVenda: string
  dataInicioViagem: string | null
  dataFimViagem: string | null
  // Empresa
  empresaNome: string
  empresaSlug: string
  /** Cor primária da empresa cadastrada no banco (#rrggbb). Fallback: #1498D5 */
  empresaCorPrimaria: string
  /** Caminho relativo ao /public do logo da empresa. Ex: brand/magic-trips-white.png */
  empresaLogoPath: string | null
  // Cliente
  clienteNome: string
  clienteCPF: string | null
  clienteEmail: string | null
  clienteTelefone: string | null
  // Agente + aprovação
  agenteNome: string
  aprovadoPorNome: string | null
  dataAprovacao: string | null
  motivoRevisao: string | null
  pax: number
  origem: string | null
  observacoes: string | null
  /** Percentual de comissão do agente congelado na venda. */
  comissaoPercentual: number | null
  // Produtos com todos os campos
  produtos: {
    ordem: number
    tipoNome: string
    fornecedorNome: string | null
    localizador: string | null
    localizadorFornecedor: string | null
    destino: string | null
    dataInicio: string | null
    dataFim: string | null
    valorVenda: number
    valorCusto: number
    rav: number
    ravExtraCliente: number
    ravExtraFornecedor: number
    comissao: number
    tipoComissao: string | null
    pgtoForma: string | null
    pgtoCartaoNome: string | null
    pgtoValorTotal: number | null
    pgtoEntrada: number
    pgtoNumParcelas: number
    pgtoValorParcela: number | null
    pgtoDataDebito: string | null
    camposExtras: { nome: string; valor: string }[]
  }[]
  // Passageiros com dados completos
  passageiros: {
    nome: string
    cpf: string | null
    dataNascimento: string | null
  }[]
  // Cobrança com todos os campos
  cobranca: {
    tipo: string
    valor: number
    parcelas: number
    valorParcela: number | null
    plataformaLink: string | null
    taxaAdquirente: number | null
    valorLiquido: number | null
    dataInicio: string | null
    dataPrimeiroRecebimento: string | null
    fornecedorDestino: string | null
    observacoes: string | null
  }[]
}

export async function getVendaParaPDF(
  id: string,
): Promise<ActionResult<VendaParaPDF>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "ler")) {
    return { ok: false, error: "Sem permissão." }
  }

  const supabase = await createClient()

  const { data: v } = await supabase
    .from("vendas")
    .select(
      `
      id, identificador, status, data_venda, pax, origem, observacoes, motivo_revisao,
      data_aprovacao, comissao_percentual, empresa_id,
      empresa:empresas(nome, slug, cor_primaria, logo_path),
      cliente:clientes(nome, cpf, email, telefone),
      agente:usuarios!vendas_usuario_id_fkey(nome, comissao_percentual, perfil_id),
      aprovador:usuarios!vendas_aprovado_por_fkey(nome)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (!v) return { ok: false, error: "Venda não encontrada." }

  const [
    { data: produtos },
    { data: passageiros },
    { data: cobranca },
    { data: camposExtraRows },
  ] = await Promise.all([
    supabase
      .from("venda_produtos")
      .select(
        `
        ordem, tipo_produto_nome, fornecedor_nome, localizador, localizador_fornecedor,
        destino, data_inicio_viagem, data_fim_viagem,
        valor_venda, valor_custo, rav, comissao_vendedor,
        rav_extra_cliente, rav_extra_fornecedor, tipo_comissao, valores_extras,
        pgto_forma, pgto_valor_total, pgto_entrada, pgto_num_parcelas,
        pgto_valor_parcela, pgto_data_debito,
        pgto_cartao:cartoes!fk_venda_produtos_cartao(nome)
      `,
      )
      .eq("venda_id", id)
      .order("ordem"),
    supabase
      .from("venda_passageiros")
      .select("nome, cpf, data_nascimento")
      .eq("venda_id", id)
      .order("ordem"),
    supabase
      .from("cobranca_cliente")
      .select(
        `itens:cobranca_cliente_itens(
          tipo, valor_total, num_parcelas, valor_parcela,
          plataforma_link, taxa_adquirente, valor_liquido,
          data_inicio, data_primeiro_recebimento,
          fornecedor_destino, observacoes
        )`,
      )
      .eq("venda_id", id)
      .maybeSingle(),
    supabase.from("campos_extra").select("id, nome"),
  ])

  type Simples = { nome: string } | null
  type AgenteComissao = { nome: string; comissao_percentual: number | null; perfil_id: string } | null
  type ClientePDF = { nome: string; cpf: string | null; email: string; telefone: string } | null
  type CartaoPDF = { nome: string } | null
  type EmpresaPDF = { nome: string; slug: string; cor_primaria: string | null; logo_path: string | null } | null

  // Mapa id → nome para campos extras
  const camposMap: Record<string, string> = {}
  for (const c of camposExtraRows ?? []) camposMap[c.id] = c.nome

  // Comissão — hierarquia idêntica a getVendaDetalhes (4 níveis)
  const agentePDF = v.agente as AgenteComissao
  let comissaoPercentual: number | null = v.comissao_percentual != null
    ? Number(v.comissao_percentual)
    : null

  if (comissaoPercentual === null) {
    // Nível 2: fixo por usuário (ex.: Jéssica 12%)
    if (agentePDF?.comissao_percentual != null) {
      comissaoPercentual = Number(agentePDF.comissao_percentual)
    } else {
      // Níveis 3 e 4: regras por origem
      const nomeOrigem = v.origem
      if (nomeOrigem) {
        const { data: origemRow } = await supabase
          .from("origens_venda")
          .select("id, comissao_percentual")
          .eq("nome", nomeOrigem)
          .maybeSingle()

        if (origemRow) {
          // Nível 3: override por perfil + origem
          if (agentePDF?.perfil_id) {
            const { data: pc } = await supabase
              .from("perfis_comissoes")
              .select("percentual")
              .eq("perfil_id", agentePDF.perfil_id)
              .eq("origem_id", origemRow.id)
              .maybeSingle()
            if (pc) comissaoPercentual = Number(pc.percentual)
          }

          // Nível 4: regra padrão por empresa + origem
          if (comissaoPercentual === null && v.empresa_id) {
            const { data: cr } = await supabase
              .from("comissoes_regras")
              .select("percentual")
              .eq("empresa_id", v.empresa_id)
              .eq("origem_id", origemRow.id)
              .maybeSingle()
            if (cr) comissaoPercentual = Number(cr.percentual)
          }

          // Nível 4b: percentual direto da origem como último fallback
          if (comissaoPercentual === null && origemRow.comissao_percentual != null) {
            comissaoPercentual = Number(origemRow.comissao_percentual)
          }
        }
      }
    }
  }

  return {
    ok: true,
    data: {
      id: v.id,
      identificador: v.identificador,
      status: v.status,
      dataVenda: v.data_venda,
      dataInicioViagem:
        (produtos ?? []).find((p) => p.data_inicio_viagem)?.data_inicio_viagem ?? null,
      dataFimViagem:
        (produtos ?? []).find((p) => p.data_fim_viagem)?.data_fim_viagem ?? null,
      empresaNome: (v.empresa as EmpresaPDF)?.nome ?? "—",
      empresaSlug: (v.empresa as EmpresaPDF)?.slug ?? "",
      empresaCorPrimaria: (v.empresa as EmpresaPDF)?.cor_primaria ?? "#1498D5",
      empresaLogoPath: (v.empresa as EmpresaPDF)?.logo_path ?? null,
      clienteNome: (v.cliente as ClientePDF)?.nome ?? "—",
      clienteCPF: (v.cliente as ClientePDF)?.cpf ?? null,
      clienteEmail: (v.cliente as ClientePDF)?.email ?? null,
      clienteTelefone: (v.cliente as ClientePDF)?.telefone ?? null,
      agenteNome: agentePDF?.nome ?? "—",
      aprovadoPorNome: (v.aprovador as Simples)?.nome ?? null,
      dataAprovacao: v.data_aprovacao ? v.data_aprovacao.slice(0, 10) : null,
      motivoRevisao: v.motivo_revisao,
      pax: v.pax,
      origem: v.origem,
      observacoes: v.observacoes,
      comissaoPercentual,
      produtos: (produtos ?? []).map((p) => {
        const rav = Number(p.rav ?? 0)
        const stored = Number(p.comissao_vendedor ?? 0)
        const comissao =
          stored > 0
            ? stored
            : comissaoPercentual !== null && rav > 0
              ? Number(((rav * comissaoPercentual) / 100).toFixed(2))
              : 0

        const extras = p.valores_extras as Record<string, unknown> | null
        const camposExtras: { nome: string; valor: string }[] = []
        if (extras) {
          for (const [campoId, val] of Object.entries(extras)) {
            if (val === null || val === undefined || val === "") continue
            camposExtras.push({ nome: camposMap[campoId] ?? campoId, valor: String(val) })
          }
        }

        return {
          ordem: p.ordem,
          tipoNome: p.tipo_produto_nome,
          fornecedorNome: p.fornecedor_nome || null,
          localizador: p.localizador ?? null,
          localizadorFornecedor: p.localizador_fornecedor ?? null,
          destino: p.destino ?? null,
          dataInicio: p.data_inicio_viagem ?? null,
          dataFim: p.data_fim_viagem ?? null,
          valorVenda: Number(p.valor_venda ?? 0),
          valorCusto: Number(p.valor_custo ?? 0),
          rav,
          ravExtraCliente: Number(p.rav_extra_cliente ?? 0),
          ravExtraFornecedor: Number(p.rav_extra_fornecedor ?? 0),
          comissao,
          tipoComissao: p.tipo_comissao ?? null,
          pgtoForma: p.pgto_forma ?? null,
          pgtoCartaoNome: (p.pgto_cartao as unknown as CartaoPDF)?.nome ?? null,
          pgtoValorTotal: p.pgto_valor_total != null ? Number(p.pgto_valor_total) : null,
          pgtoEntrada: Number(p.pgto_entrada ?? 0),
          pgtoNumParcelas: Number(p.pgto_num_parcelas ?? 1),
          pgtoValorParcela: p.pgto_valor_parcela != null ? Number(p.pgto_valor_parcela) : null,
          pgtoDataDebito: p.pgto_data_debito ?? null,
          camposExtras,
        }
      }),
      passageiros: (passageiros ?? []).map((p) => ({
        nome: p.nome,
        cpf: p.cpf ?? null,
        dataNascimento: p.data_nascimento ?? null,
      })),
      cobranca: (
        (
          cobranca?.itens as unknown as Array<{
            tipo: string
            valor_total: number
            num_parcelas: number
            valor_parcela: number | null
            plataforma_link: string | null
            taxa_adquirente: number | null
            valor_liquido: number | null
            data_inicio: string | null
            data_primeiro_recebimento: string | null
            fornecedor_destino: string | null
            observacoes: string | null
          }>
        ) ?? []
      ).map((it) => ({
        tipo: it.tipo,
        valor: Number(it.valor_total),
        parcelas: it.num_parcelas,
        valorParcela: it.valor_parcela != null ? Number(it.valor_parcela) : null,
        plataformaLink: it.plataforma_link ?? null,
        taxaAdquirente: it.taxa_adquirente != null ? Number(it.taxa_adquirente) : null,
        valorLiquido: it.valor_liquido != null ? Number(it.valor_liquido) : null,
        dataInicio: it.data_inicio ?? null,
        dataPrimeiroRecebimento: it.data_primeiro_recebimento ?? null,
        fornecedorDestino: it.fornecedor_destino ?? null,
        observacoes: it.observacoes ?? null,
      })),
    },
  }
}

/**
 * Carrega todos os dados pro wizard de nova venda. Lido pelo `NovaVendaModal`
 * sob demanda quando o usuário abre o modal — exibe `ModalLoader` durante a busca.
 */
export async function getDadosNovaVenda(): Promise<ActionResult<DadosNovaVenda>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "criar")) {
    return { ok: false, error: "Sem permissão para criar vendas." }
  }

  const supabase = await createClient()

  const empresas = user.acessaTodasEmpresas
    ? (
        await supabase
          .from("empresas")
          .select("id, nome, slug")
          .eq("ativo", true)
          .order("nome")
      ).data ?? []
    : user.empresas.map((e) => ({ id: e.id, nome: e.nome, slug: e.slug }))

  const [
    { data: clientes },
    { data: fornecedores },
    { data: cartoes },
    { data: origens },
    { data: tipos },
    { data: vinculos },
    { data: campos },
    { data: opcoes },
    { data: usuariosAtivos },
    { data: comissoesRegrasRaw },
    { data: perfisComissoesRaw },
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, email, empresa_id")
      .eq("status", "ativo")
      .order("nome"),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("cartoes")
      .select("id, nome, banco, empresa_id, dia_vencimento")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("origens_venda")
      .select("id, nome, comissao_percentual")
      .eq("ativo", true)
      .order("ordem"),
    supabase
      .from("tipos_produto")
      .select("id, nome, icone")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("tipos_produto_campos")
      .select("tipo_produto_id, campo_id, obrigatorio, ordem"),
    supabase
      .from("campos_extra")
      .select("id, nome, tipo_campo, placeholder")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("campos_extra_opcoes")
      .select("campo_id, valor, ordem")
      .eq("ativo", true)
      .order("ordem"),
    supabase.from("usuarios").select("id, nome, perfil_id, comissao_percentual").eq("ativo", true).order("nome"),
    supabase.from("comissoes_regras").select("empresa_id, origem_id, percentual"),
    supabase.from("perfis_comissoes").select("perfil_id, origem_id, percentual"),
  ])

  const vinculosPorTipo = new Map<
    string,
    { campo_id: string; obrigatorio: boolean; ordem: number }[]
  >()
  for (const v of vinculos ?? []) {
    const arr = vinculosPorTipo.get(v.tipo_produto_id) ?? []
    arr.push({ campo_id: v.campo_id, obrigatorio: v.obrigatorio, ordem: v.ordem })
    vinculosPorTipo.set(v.tipo_produto_id, arr)
  }
  const tiposProduto = (tipos ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    icone: t.icone ?? null,
    campos: vinculosPorTipo.get(t.id) ?? [],
  }))

  const opcoesPorCampo = new Map<string, { valor: string }[]>()
  for (const o of opcoes ?? []) {
    const arr = opcoesPorCampo.get(o.campo_id) ?? []
    arr.push({ valor: o.valor })
    opcoesPorCampo.set(o.campo_id, arr)
  }
  const camposExtra = (campos ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo_campo: c.tipo_campo,
    placeholder: c.placeholder,
    opcoes: opcoesPorCampo.get(c.id) ?? [],
  }))

  return {
    ok: true,
    data: {
      empresas,
      defaultEmpresaId: empresas.length === 1 ? empresas[0]!.id : undefined,
      clientes: clientes ?? [],
      fornecedores: fornecedores ?? [],
      cartoes: cartoes ?? [],
      origens: (origens ?? []).map((o) => ({
        id: o.id,
        nome: o.nome,
        comissao_percentual: (o.comissao_percentual as number | null) ?? null,
      })),
      tiposProduto,
      camposExtra,
      comissoesRegras: (comissoesRegrasRaw ?? []).map((r) => ({
        empresa_id: r.empresa_id,
        origem_id: r.origem_id,
        percentual: Number(r.percentual),
      })),
      perfisComissoes: (perfisComissoesRaw ?? []).map((p) => ({
        perfil_id: p.perfil_id,
        origem_id: p.origem_id,
        percentual: Number(p.percentual),
      })),
      usuariosAgentes: (usuariosAtivos ?? []).map((u) => ({
        id: u.id,
        nome: u.nome,
        perfil_id: u.perfil_id,
        comissao_percentual: (u.comissao_percentual as number | null) ?? null,
      })),
      usuarioLogadoId: user.id,
      podeTrocarAgente: can(user, "vendas", "aprovar"),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Carrega venda existente para edição pelo Gerente/Admin
// ─────────────────────────────────────────────────────────────────────────────

function numStr(v: number | string | null | undefined): string {
  if (v == null || v === "") return ""
  const n = Number(v)
  if (isNaN(n) || n === 0) return ""
  return n.toFixed(2).replace(".", ",")
}

export type VendaParaEditar = {
  dados: DadosNovaVenda
  draft: {
    step: 1
    maxStep: 5
    empresaId: string
    dataVenda: string
    dataInicioViagem: string
    dataFimViagem: string
    clienteValue: string | null
    clienteNovo: {
      tipo_pessoa: "fisica" | "juridica"
      nome: string; cpf: string; data_nascimento: string
      razao_social: string; nome_fantasia: string; cnpj: string; responsavel: string
      email: string; telefone: string
      tipo: "regular" | "faturado"; dia_faturamento: string
    }
    pax: number
    origem: string
    indicacao: number
    agenteId: string
    observacoesGerais: string
    produtos: {
      id: string
      tipo_produto_id: string
      valor_venda_str: string; valor_custo_str: string; rav_str: string
      rav_extra_cliente_str: string; rav_extra_fornecedor_str: string
      comissao_vendedor_str: string
      valores_extras: Record<string, string>
      pgto_forma: string; pgto_cartao_id: string
      pgto_valor_total_str: string; pgto_entrada_str: string
      pgto_num_parcelas: number
    }[]
    cobrancaItens: {
      tipo: string; outro_descricao: string; valor_total_str: string
      num_parcelas: number; plataforma_link: string
      taxa_adquirente_str: string; valor_liquido_str: string
      data_inicio: string; data_primeiro_recebimento: string; observacoes: string
    }[]
    cobrancaObs: string
    passageiros: { id: string; nome: string; cpf: string; data_nascimento: string }[]
  }
}

export async function getVendaParaEditar(
  id: string,
): Promise<ActionResult<VendaParaEditar>> {
  const user = await requireCurrentUser()
  const canApprove = can(user, "vendas", "aprovar")

  const supabase = await createClient()

  // Carrega a venda para verificar propriedade/status antes das demais queries
  const { data: vendaCheck } = await supabase
    .from("vendas")
    .select("usuario_id, status")
    .eq("id", id)
    .single()

  if (!vendaCheck) return { ok: false, error: "Venda não encontrada." }

  // Gerente/Admin com aprovar: acesso total. Agente: só a própria venda em_revisao.
  const isOwnerEmRevisao =
    vendaCheck.usuario_id === user.id && vendaCheck.status === "em_revisao"

  if (!canApprove && !isOwnerEmRevisao) {
    return { ok: false, error: "Sem permissão." }
  }

  const [dadosRes, { data: v }, { data: produtos }, { data: passageiros }, { data: cobranca }] =
    await Promise.all([
      getDadosNovaVenda(),
      supabase
        .from("vendas")
        .select("id, empresa_id, cliente_id, usuario_id, data_venda, origem, indicacao_percentual, comissao_percentual, pax, observacoes")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("venda_produtos")
        .select("tipo_produto_id, valor_venda, valor_custo, rav, rav_extra_cliente, rav_extra_fornecedor, comissao_vendedor, valores_extras, pgto_forma, pgto_cartao_id, pgto_valor_total, pgto_entrada, pgto_num_parcelas, pgto_valor_parcela, pgto_data_debito, data_inicio_viagem, data_fim_viagem")
        .eq("venda_id", id)
        .order("ordem"),
      supabase
        .from("venda_passageiros")
        .select("nome, cpf, data_nascimento")
        .eq("venda_id", id)
        .order("ordem"),
      supabase
        .from("cobranca_cliente")
        .select("observacoes, itens:cobranca_cliente_itens(tipo, valor_total, num_parcelas, valor_parcela, plataforma_link, taxa_adquirente, valor_liquido, data_inicio, data_primeiro_recebimento, observacoes)")
        .eq("venda_id", id)
        .maybeSingle(),
    ])

  if (!dadosRes.ok) return { ok: false, error: dadosRes.error ?? "Erro ao carregar dados." }
  if (!dadosRes.data) return { ok: false, error: "Erro ao carregar dados." }
  if (!v) return { ok: false, error: "Venda não encontrada." }

  const dataInicioViagem = (produtos ?? []).find((p) => p.data_inicio_viagem)?.data_inicio_viagem ?? ""
  const dataFimViagem    = (produtos ?? []).find((p) => p.data_fim_viagem)?.data_fim_viagem ?? ""

  type ItemRaw = {
    tipo: string; valor_total: number | null; num_parcelas: number | null
    valor_parcela: number | null; plataforma_link: string | null
    taxa_adquirente: number | null; valor_liquido: number | null
    data_inicio: string | null; data_primeiro_recebimento: string | null
    observacoes: string | null
  }
  const itensRaw = (cobranca?.itens as unknown as ItemRaw[] | null) ?? []

  const draft: VendaParaEditar["draft"] = {
    step: 1,
    maxStep: 5,
    empresaId:        v.empresa_id ?? "",
    dataVenda:        v.data_venda ?? "",
    dataInicioViagem: dataInicioViagem ?? "",
    dataFimViagem:    dataFimViagem ?? "",
    clienteValue:     v.cliente_id ?? null,
    clienteNovo: {
      tipo_pessoa: "fisica", nome: "", cpf: "", data_nascimento: "",
      razao_social: "", nome_fantasia: "", cnpj: "", responsavel: "",
      email: "", telefone: "", tipo: "regular", dia_faturamento: "",
    },
    pax:               v.pax ?? 1,
    origem:            v.origem ?? "",
    indicacao:         Number(v.indicacao_percentual ?? 0),
    agenteId:          v.usuario_id ?? user.id,
    observacoesGerais: v.observacoes ?? "",
    produtos: (produtos ?? []).map((p) => ({
      id:                      crypto.randomUUID(),
      tipo_produto_id:          p.tipo_produto_id ?? "",
      valor_venda_str:          numStr(p.valor_venda),
      valor_custo_str:          numStr(p.valor_custo),
      rav_str:                  numStr(p.rav),
      rav_extra_cliente_str:    numStr(p.rav_extra_cliente),
      rav_extra_fornecedor_str: numStr(p.rav_extra_fornecedor),
      comissao_vendedor_str:    numStr(p.comissao_vendedor),
      valores_extras:           (p.valores_extras as Record<string, string> | null) ?? {},
      pgto_forma:               p.pgto_forma ?? "cartao",
      pgto_cartao_id:           p.pgto_cartao_id ?? "",
      pgto_valor_total_str:     numStr(p.pgto_valor_total),
      pgto_entrada_str:         numStr(p.pgto_entrada),
      pgto_num_parcelas:        Number(p.pgto_num_parcelas ?? 1),
    })),
    cobrancaItens: itensRaw.map((it) => ({
      tipo:                     it.tipo ?? "pix",
      outro_descricao:          it.tipo === "outro" ? (it.observacoes ?? "") : "",
      valor_total_str:          numStr(it.valor_total),
      num_parcelas:             Number(it.num_parcelas ?? 1),
      plataforma_link:          it.plataforma_link ?? "",
      taxa_adquirente_str:      numStr(it.taxa_adquirente),
      valor_liquido_str:        numStr(it.valor_liquido),
      data_inicio:              it.data_inicio ?? "",
      data_primeiro_recebimento: it.data_primeiro_recebimento ?? "",
      observacoes:              it.tipo !== "outro" ? (it.observacoes ?? "") : "",
    })),
    cobrancaObs: cobranca?.observacoes ?? "",
    passageiros: (passageiros ?? []).map((p) => ({
      id:              crypto.randomUUID(),
      nome:            p.nome ?? "",
      cpf:             p.cpf ?? "",
      data_nascimento: p.data_nascimento ?? "",
    })),
  }

  return { ok: true, data: { dados: dadosRes.data, draft } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edita e aprova venda em uma operação (modo Gerente)
// ─────────────────────────────────────────────────────────────────────────────

export async function editarEAprovarVenda(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  if (!can(user, "vendas", "aprovar")) {
    return { ok: false, error: "Sem permissão para aprovar vendas." }
  }

  const parsed = vendaCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("editar_venda_completa", {
    p_venda_id: id,
    p_payload:  JSON.parse(JSON.stringify(parsed.data)),
    p_aprovar:  true,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/vendas")
  revalidatePath("/dashboard")
  return { ok: true, data: { id } }
}

// ─────────────────────────���───────────────────────────��───────────────────────
// Agente corrige venda em_revisao e resubmete para validação
// ─────────────────────────────────────────────────────────────────────��───────

export async function resubmeterVenda(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()

  const parsed = vendaCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos.",
      fieldErrors: flatten(parsed.error.flatten().fieldErrors),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("resubmeter_venda", {
    p_venda_id: id,
    p_payload:  JSON.parse(JSON.stringify(parsed.data)),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/vendas")
  revalidatePath("/dashboard")
  return { ok: true, data: { id } }
}
