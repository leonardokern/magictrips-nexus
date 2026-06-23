"use server"

import { revalidatePath } from "next/cache"
import QRCode from "qrcode"
import { createClient } from "@/lib/supabase/server"
import { requireCurrentUser } from "@/lib/hooks/use-current-user"
import { can } from "@/lib/hooks/use-permissions"
import type { ActionResult } from "@/app/(dashboard)/clientes/actions"
import type { FaturaData } from "@/components/pdf/fatura-pdf"
import { gerarPixBRCode } from "@/lib/utils/pix-brcode"

// Os dados de PIX + bancários vivem em `empresas` (cnpj, cidade,
// razao_social, banco_*). Cada empresa tem o próprio — sem placeholders.

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência bancária",
  dinheiro: "Dinheiro",
  faturado: "Faturado",
  link_externo: "Link externo",
  outro: "Outro",
}

/**
 * Marca uma parcela como paga (ou desfaz, marcando como pendente). Aceita
 * dataPagamento opcional — quando ausente, usa hoje. Disponível pra
 * parcelas_receber e parcelas_pagar (escolhe a tabela via `tipo`).
 *
 * Restrito a usuários com `financeiro.editar`.
 */
export async function marcarParcelaPaga(args: {
  tipo: "receber" | "pagar"
  parcelaId: string
  dataPagamento?: string | null
  status: "pago" | "pendente"
}): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "editar")) {
    return { ok: false, error: "Sem permissão para alterar parcelas." }
  }

  const supabase = await createClient()
  const tabela = args.tipo === "receber" ? "parcelas_receber" : "parcelas_pagar"

  const dataPagamento =
    args.status === "pago"
      ? args.dataPagamento ?? new Date().toISOString().slice(0, 10)
      : null

  const { error } = await supabase
    .from(tabela)
    .update({ status: args.status, data_pagamento: dataPagamento })
    .eq("id", args.parcelaId)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/financeiro/receber")
  revalidatePath("/financeiro/pagar")
  revalidatePath("/fluxo-de-caixa")
  revalidatePath("/dashboard")
  return { ok: true, data: undefined }
}

/**
 * Hidrata os dados de uma parcela de recebimento pra geração do PDF
 * de fatura. Retorna `null` se a parcela não existe ou o usuário não tem
 * acesso (RLS já barra parcelas fora da empresa). Inclui a instrução de
 * pagamento construída a partir da empresa (ex: chave PIX padrão).
 */
export async function getParcelaParaFatura(
  parcelaId: string,
): Promise<{ data: FaturaData; logoPath: string | null } | null> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) return null

  const supabase = await createClient()
  const { data: parcela } = await supabase
    .from("parcelas_receber")
    .select(
      `
      id, venda_id, cobranca_item_id, numero, total_parcelas, descricao, valor, forma_pagamento,
      data_vencimento, data_pagamento, status,
      cliente:clientes(nome, cpf, cnpj, email, telefone),
      venda:vendas(
        identificador, data_venda,
        empresa:empresas(nome, slug, cor_primaria, logo_path, cnpj, cidade, razao_social, banco_nome, banco_agencia, banco_conta)
      ),
      cobranca_item:cobranca_cliente_itens(taxa_cobranca, valor_total)
    `,
    )
    .eq("id", parcelaId)
    .maybeSingle()

  if (!parcela) return null

  // Busca produtos da venda + dicionário de campos extras pra resolver
  // os UUIDs em `valores_extras` no nome legível (ex.: "Cia Aérea: LATAM").
  const [produtosRes, camposRes] = parcela.venda_id
    ? await Promise.all([
        supabase
          .from("venda_produtos")
          .select(
            "tipo_produto_nome, data_inicio_viagem, data_fim_viagem, valores_extras",
          )
          .eq("venda_id", parcela.venda_id)
          .order("ordem", { ascending: true }),
        supabase.from("campos_extra").select("id, nome"),
      ])
    : [{ data: null }, { data: null }]
  const produtosRaw = produtosRes.data
  const camposExtra = camposRes.data ?? []
  const campoNomeById = new Map<string, string>(
    (camposExtra as { id: string; nome: string }[]).map((c) => [c.id, c.nome]),
  )

  type ClienteRel = {
    nome: string
    cpf: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
  } | null
  type EmpresaRel = {
    nome: string
    slug: string
    cor_primaria: string | null
    logo_path: string | null
    cnpj: string | null
    cidade: string | null
    razao_social: string | null
    banco_nome: string | null
    banco_agencia: string | null
    banco_conta: string | null
  } | null
  type VendaRel = {
    identificador: string
    data_venda: string
    empresa: EmpresaRel | EmpresaRel[] | null
  } | null

  const cliRaw = Array.isArray(parcela.cliente)
    ? parcela.cliente[0]
    : (parcela.cliente as ClienteRel)
  const vRaw = Array.isArray(parcela.venda)
    ? parcela.venda[0]
    : (parcela.venda as VendaRel)
  const eRaw = vRaw?.empresa
    ? Array.isArray(vRaw.empresa)
      ? vRaw.empresa[0]
      : vRaw.empresa
    : null

  const hoje = new Date().toISOString().slice(0, 10)
  const ehAtrasado =
    parcela.status === "pendente" && parcela.data_vencimento < hoje
  const statusLabel =
    parcela.status === "pago"
      ? "Pago"
      : parcela.status === "cancelado"
        ? "Cancelado"
        : ehAtrasado
          ? "Atrasado"
          : "Pendente"

  const empresaNome = eRaw?.nome ?? "—"
  const empresaCor = eRaw?.cor_primaria ?? "#1498D5"

  // Estrutura cada produto da venda em 3 linhas (Produto / Datas /
  // Campos personalizados) — renderizado em multi-linha no PDF.
  type ProdRow = {
    tipo_produto_nome: string | null
    data_inicio_viagem: string | null
    data_fim_viagem: string | null
    valores_extras: Record<string, unknown> | null
  }
  const produtos = (produtosRaw ?? []) as ProdRow[]

  const fmtBR = (iso: string | null): string => {
    if (!iso) return "—"
    const [y, m, d] = iso.split("-")
    return d && m && y ? `${d}/${m}/${y}` : iso
  }

  const itensVenda = produtos.map((p) => {
    const produto = (p.tipo_produto_nome ?? "").trim() || "Produto"

    // Datas da viagem — só renderiza quando tem ao menos uma das pontas.
    let datasViagem: string | null = null
    if (p.data_inicio_viagem || p.data_fim_viagem) {
      datasViagem = `${fmtBR(p.data_inicio_viagem)} → ${fmtBR(p.data_fim_viagem)}`
    }

    // Campos personalizados resolvidos via dicionário id→nome. Apenas
    // valores não-vazios entram. Junta em "Nome: valor · Nome: valor".
    let camposExtras: string | null = null
    const extras = p.valores_extras ?? {}
    const partes: string[] = []
    for (const [campoId, raw] of Object.entries(extras)) {
      if (raw == null) continue
      const valor = String(raw).trim()
      if (!valor) continue
      const nome = campoNomeById.get(campoId) ?? campoId
      partes.push(`${nome}: ${valor}`)
    }
    if (partes.length > 0) camposExtras = partes.join(" · ")

    return { produto, datasViagem, camposExtras }
  })

  // Fallback: se a venda não tem produtos resolvidos, gera 1 item com
  // a descrição original da parcela (ex.: "Cobrança pix — parcela 1/3").
  if (itensVenda.length === 0) {
    itensVenda.push({
      produto: parcela.descricao ?? "Cobrança da venda",
      datasViagem: null,
      camposExtras: null,
    })
  }

  const data: FaturaData = {
    empresaNome,
    empresaCor,
    empresaSlug: eRaw?.slug ?? "",
    empresaLogoPath: eRaw?.logo_path ?? null,
    vendaIdentificador: vRaw?.identificador ?? "—",
    dataVenda: vRaw?.data_venda ?? "",
    // Padrão #INV-AAAA-NNNN/P
    //  AAAA = ano corrente da emissão
    //  NNNN = sufixo do identificador da venda (parte após o "-")
    //  P    = número da parcela
    // Ex.: venda MT-0016, parcela 1 → "#INV-2026-0016/1"
    faturaNumero: (() => {
      const ano = new Date().getFullYear()
      const ident = vRaw?.identificador ?? ""
      const sufixo = ident.includes("-")
        ? ident.split("-").slice(-1)[0] ?? ident
        : ident || "0000"
      return `#INV-${ano}-${sufixo}/${parcela.numero}`
    })(),
    dataEmissao: hoje,
    cliente: {
      nome: cliRaw?.nome ?? "—",
      cpf: cliRaw?.cpf ?? null,
      cnpj: cliRaw?.cnpj ?? null,
      email: cliRaw?.email ?? null,
      telefone: cliRaw?.telefone ?? null,
    },
    parcela: {
      numero: parcela.numero,
      total: parcela.total_parcelas,
      itens: itensVenda,
      taxaCobranca: (() => {
        const it = Array.isArray(parcela.cobranca_item)
          ? parcela.cobranca_item[0]
          : parcela.cobranca_item
        const t = (it as { taxa_cobranca?: number | string } | null | undefined)?.taxa_cobranca
        return t == null ? 0 : Number(t)
      })(),
      valorBase: (() => {
        const valor = Number(parcela.valor ?? 0)
        const it = Array.isArray(parcela.cobranca_item)
          ? parcela.cobranca_item[0]
          : parcela.cobranca_item
        const t = (it as { taxa_cobranca?: number | string } | null | undefined)?.taxa_cobranca
        const taxa = t == null ? 0 : Number(t)
        if (taxa <= 0) return valor
        return Number((valor / (1 + taxa / 100)).toFixed(2))
      })(),
      valor: Number(parcela.valor ?? 0),
      dataVencimento: parcela.data_vencimento,
      formaPagamento: parcela.forma_pagamento
        ? FORMA_LABEL[parcela.forma_pagamento] ?? parcela.forma_pagamento
        : "—",
      statusLabel,
    },
    instrucaoPagamento: instrucaoPagamento(parcela.forma_pagamento, empresaNome),
    pix: null,
    dadosBancarios: null,
  }

  // ── Pix + dados bancários ──────────────────────────────────────────
  // Lê do cadastro da empresa. Quando os campos não estão preenchidos,
  // o bloco correspondente fica null e a fatura simplesmente não
  // renderiza essa seção (defensivo pra empresas sem dados cadastrados).
  const cnpjFormatado = eRaw?.cnpj ?? null
  const cidadeEmpresa = eRaw?.cidade ?? null
  if (cnpjFormatado && cidadeEmpresa) {
    try {
      const cnpjDigits = cnpjFormatado.replace(/\D/g, "")
      const brCode = gerarPixBRCode({
        chave: cnpjDigits,
        nome: eRaw?.razao_social ?? empresaNome,
        cidade: cidadeEmpresa,
        valor: data.parcela.valor,
        txid: data.faturaNumero.replace(/[^A-Za-z0-9]/g, "").slice(0, 25),
      })
      const qrDataUrl = await QRCode.toDataURL(brCode, {
        type: "image/png",
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#1A1F4D", light: "#FFFFFF" },
      })
      data.pix = {
        chave: cnpjDigits,
        chaveLabel: `CNPJ ${cnpjFormatado}`,
        qrDataUrl,
        brCode,
      }
    } catch {
      // Sem QR, a fatura ainda renderiza com dados bancários abaixo.
    }
  }

  if (eRaw?.banco_nome && eRaw.banco_agencia && eRaw.banco_conta) {
    data.dadosBancarios = {
      banco: eRaw.banco_nome,
      agencia: eRaw.banco_agencia,
      conta: eRaw.banco_conta,
      titular: eRaw.razao_social ?? empresaNome,
      cnpjTitular: cnpjFormatado ?? "—",
    }
  }

  return { data, logoPath: eRaw?.logo_path ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Módulo de Faturas Agrupadas
// ─────────────────────────────────────────────────────────────────────────────

export type ClienteComParcelas = { id: string; nome: string }

export type ParcelaParaFatura = {
  id: string
  descricao: string | null
  numero: number
  total_parcelas: number
  valor: number
  data_vencimento: string
  forma_pagamento: string | null
  venda_identificador: string | null
  /** Primeiro fatura_id vinculado (referência), null se nenhum */
  fatura_id: string | null
  /** Todos os números de fatura desta parcela, separados por "; ". Null se nenhum. */
  fatura_numeros_display: string | null
}

export type CriarFaturaResult =
  | { ok: true; fatura: { id: string; numero_display: string } }
  | { ok: false; error: string; fatura_existente_id?: string }

/**
 * Todos os clientes que possuem ao menos uma parcela de recebimento pendente,
 * independentemente de já terem ou não fatura vinculada.
 */
export async function getClientesComParcelasPendentes(): Promise<ClienteComParcelas[]> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from("parcelas_receber")
    .select("cliente:clientes(id, nome)")
    .eq("status", "pendente")
    .not("cliente_id", "is", null)

  if (!data) return []

  const seen = new Set<string>()
  const clientes: ClienteComParcelas[] = []
  for (const row of data) {
    const c = Array.isArray(row.cliente) ? row.cliente[0] : row.cliente
    if (!c || seen.has(c.id)) continue
    seen.add(c.id)
    clientes.push({ id: c.id, nome: c.nome })
  }
  return clientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

/**
 * Parcelas de recebimento de um cliente — pendentes (disponíveis para
 * faturar) e já faturadas (exibidas no modal como desabilitadas).
 */
export async function getParcelasPendentesDoCliente(
  clienteId: string,
): Promise<ParcelaParaFatura[]> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from("parcelas_receber")
    .select(
      `
      id, descricao, numero, total_parcelas, valor, data_vencimento, forma_pagamento,
      venda:vendas(identificador),
      fatura_parcelas(fatura_id, fatura:faturas(numero_display))
    `,
    )
    .eq("cliente_id", clienteId)
    .eq("status", "pendente")
    .order("data_vencimento", { ascending: true })

  if (!data) return []

  return data.map((p) => {
    const vnd = Array.isArray(p.venda) ? p.venda[0] : p.venda
    type FPRow = { fatura_id?: string; fatura?: { numero_display?: string } | { numero_display?: string }[] }
    const fps = (Array.isArray(p.fatura_parcelas)
      ? p.fatura_parcelas
      : p.fatura_parcelas ? [p.fatura_parcelas] : []) as FPRow[]

    const primeirFaturaId = fps[0]?.fatura_id ?? null

    const numeros = fps
      .map((fp) => {
        const fat = fp.fatura
          ? Array.isArray(fp.fatura) ? fp.fatura[0] : fp.fatura
          : null
        return fat?.numero_display ?? null
      })
      .filter((n): n is string => n !== null)

    return {
      id: p.id,
      descricao: p.descricao ?? null,
      numero: p.numero,
      total_parcelas: p.total_parcelas,
      valor: Number(p.valor ?? 0),
      data_vencimento: p.data_vencimento,
      forma_pagamento: p.forma_pagamento ?? null,
      venda_identificador: vnd?.identificador ?? null,
      fatura_id: primeirFaturaId,
      fatura_numeros_display: numeros.length > 0 ? numeros.join("; ") : null,
    }
  })
}

/**
 * Cria uma fatura agrupando N parcelas de recebimento de um mesmo cliente.
 * Deduplicação por conjunto exato: se as mesmas parcelas (mesmo conjunto, mesma fatura)
 * já existem, retorna a fatura existente em vez de criar duplicata.
 * Uma parcela pode agora fazer parte de múltiplas faturas (constraint UNIQUE por fatura+parcela).
 */
export async function criarFatura(args: {
  clienteId: string
  parcelaIds: string[]
}): Promise<CriarFaturaResult> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "criar")) {
    return { ok: false, error: "Sem permissão para criar faturas." }
  }
  if (args.parcelaIds.length === 0) {
    return { ok: false, error: "Selecione ao menos uma parcela." }
  }

  const supabase = await createClient()

  // Verifica se existe uma fatura com EXATAMENTE esse conjunto de parcelas.
  // Passo 1: faturas que contêm ao menos uma das parcelas selecionadas.
  const { data: overlap } = await supabase
    .from("fatura_parcelas")
    .select("fatura_id, parcela_id")
    .in("parcela_id", args.parcelaIds)

  if (overlap && overlap.length > 0) {
    // Agrupa parcelas por fatura candidata
    const faturaMap = new Map<string, Set<string>>()
    for (const fp of overlap) {
      if (!faturaMap.has(fp.fatura_id)) faturaMap.set(fp.fatura_id, new Set())
      faturaMap.get(fp.fatura_id)!.add(fp.parcela_id)
    }

    // Para cada fatura cujo overlap == tamanho selecionado, verifica contagem total
    for (const [faturaId, overlappingSet] of faturaMap) {
      if (overlappingSet.size !== args.parcelaIds.length) continue
      const { count } = await supabase
        .from("fatura_parcelas")
        .select("*", { count: "exact", head: true })
        .eq("fatura_id", faturaId)
      if (count === args.parcelaIds.length) {
        return {
          ok: false,
          error: "Já existe uma fatura com exatamente essas parcelas.",
          fatura_existente_id: faturaId,
        }
      }
    }
  }

  // Busca empresa do usuário + código de fatura
  const { data: ue } = await supabase
    .from("usuarios_empresas")
    .select("empresa:empresas(id, codigo_fatura)")
    .eq("usuario_id", user.id)
    .limit(1)
    .single()

  type EmpLink = { id: string; codigo_fatura: string | null }
  const ueAny = ue as unknown as { empresa?: EmpLink | EmpLink[] } | null
  const empRaw = ueAny?.empresa
  const emp: EmpLink | undefined = empRaw
    ? Array.isArray(empRaw) ? empRaw[0] : empRaw
    : undefined

  if (!emp?.id) return { ok: false, error: "Empresa não encontrada." }

  // Valida que as parcelas pertencem ao cliente/empresa e estão pendentes
  const { data: parcelas } = await supabase
    .from("parcelas_receber")
    .select("id, valor")
    .in("id", args.parcelaIds)
    .eq("cliente_id", args.clienteId)
    .eq("empresa_id", emp.id)
    .eq("status", "pendente")

  if (!parcelas || parcelas.length !== args.parcelaIds.length) {
    return { ok: false, error: "Parcelas inválidas ou não pertencem ao cliente/empresa." }
  }

  const valorTotal = parcelas.reduce((sum, p) => sum + Number(p.valor ?? 0), 0)
  const ano = new Date().getFullYear()

  // Próximo sequencial via RPC
  const { data: seqData } = await supabase.rpc("proximo_numero_fatura", {
    p_empresa_id: emp.id,
    p_ano: ano,
  })
  const seq = Number(seqData ?? 1)
  const codEmpresa = (emp.codigo_fatura ?? "00").padStart(2, "0")
  const seqStr = String(seq).padStart(4, "0")
  const numero = `INV-${ano}-${codEmpresa}${seqStr}`
  const numero_display = `#${numero}`

  // Insere fatura
  const { data: fatura, error: fatErr } = await supabase
    .from("faturas")
    .insert({ empresa_id: emp.id, cliente_id: args.clienteId, numero, numero_display, numero_sequencial: seq, ano, valor_total: valorTotal })
    .select("id, numero_display")
    .single()

  if (fatErr || !fatura) {
    return { ok: false, error: fatErr?.message ?? "Erro ao criar fatura." }
  }

  // Vincula parcelas
  const { error: fpErr } = await supabase
    .from("fatura_parcelas")
    .insert(args.parcelaIds.map((parcelaId) => ({ fatura_id: fatura.id, parcela_id: parcelaId })))

  if (fpErr) {
    await supabase.from("faturas").delete().eq("id", fatura.id)
    return { ok: false, error: fpErr.message }
  }

  revalidatePath("/financeiro/receber")
  return { ok: true, fatura: { id: fatura.id, numero_display: fatura.numero_display } }
}

export type FaturaAgrupadaData = {
  empresaNome: string
  empresaCor: string
  empresaSlug: string
  empresaLogoPath: string | null
  faturaNumero: string
  dataEmissao: string
  cliente: {
    nome: string
    cpf: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
  }
  parcelas: Array<{
    /** Identificador da venda (ex: "MT-0020") ou descrição da parcela */
    descricao: string
    /** "1/1", "2/3" etc */
    numeroParcela: string
    dataVencimento: string
    valor: number
    /** Produtos da venda com campos personalizados, mesmo padrão do FaturaPDF */
    produtos: Array<{
      produto: string
      datasViagem: string | null
      camposExtras: string | null
    }>
  }>
  valorTotal: number
  instrucaoPagamento: string | null
  pix: {
    chave: string
    chaveLabel: string
    qrDataUrl: string
    brCode: string
  } | null
  dadosBancarios: {
    banco: string
    agencia: string
    conta: string
    titular: string
    cnpjTitular: string
  } | null
}

/**
 * Hidrata os dados de uma fatura agrupada para geração do PDF.
 * Gera QR Code PIX sobre o valor total.
 */
export async function getFaturaParaPDF(
  faturaId: string,
): Promise<{ data: FaturaAgrupadaData; logoPath: string | null } | null> {
  const user = await requireCurrentUser()
  if (!can(user, "financeiro", "ler")) return null

  const supabase = await createClient()

  const [faturaRes, camposRes] = await Promise.all([
    supabase
      .from("faturas")
      .select(
        `
        id, numero_display, data_emissao, valor_total,
        empresa:empresas(nome, slug, cor_primaria, logo_path, cnpj, cidade, razao_social, banco_nome, banco_agencia, banco_conta),
        cliente:clientes(nome, cpf, cnpj, email, telefone),
        fatura_parcelas(
          fatura_id,
          parcela:parcelas_receber(
            id, descricao, numero, total_parcelas, valor, data_vencimento, forma_pagamento,
            venda:vendas(
              identificador,
              venda_produtos(tipo_produto_nome, ordem, data_inicio_viagem, data_fim_viagem, valores_extras)
            )
          )
        )
      `,
      )
      .eq("id", faturaId)
      .maybeSingle(),
    supabase.from("campos_extra").select("id, nome"),
  ])

  const fatura = faturaRes.data
  if (!fatura) return null

  const camposExtra = camposRes.data ?? []
  const campoNomeById = new Map<string, string>(
    (camposExtra as { id: string; nome: string }[]).map((c) => [c.id, c.nome]),
  )

  type EmpRel = {
    nome: string; slug: string; cor_primaria: string | null; logo_path: string | null
    cnpj: string | null; cidade: string | null; razao_social: string | null
    banco_nome: string | null; banco_agencia: string | null; banco_conta: string | null
  } | null
  type CliRel = { nome: string; cpf: string | null; cnpj: string | null; email: string | null; telefone: string | null } | null

  const eRaw = Array.isArray(fatura.empresa) ? fatura.empresa[0] : (fatura.empresa as EmpRel)
  const cRaw = Array.isArray(fatura.cliente) ? fatura.cliente[0] : (fatura.cliente as CliRel)

  const fmtBR = (iso: string | null) => {
    if (!iso) return "—"
    const [y, m, d] = iso.split("-")
    return d && m && y ? `${d}/${m}/${y}` : iso
  }

  const fps = Array.isArray(fatura.fatura_parcelas) ? fatura.fatura_parcelas : []
  type VendaProdRow = {
    tipo_produto_nome?: string | null
    ordem?: number
    data_inicio_viagem?: string | null
    data_fim_viagem?: string | null
    valores_extras?: Record<string, unknown> | null
  }
  type PRow = {
    descricao?: string | null; numero?: number; total_parcelas?: number
    valor?: number | string; data_vencimento?: string; forma_pagamento?: string | null
    venda?: {
      identificador?: string
      venda_produtos?: VendaProdRow | VendaProdRow[]
    } | { identificador?: string; venda_produtos?: VendaProdRow | VendaProdRow[] }[] | null
  }

  // Captura forma_pagamento da primeira parcela (para instrucaoPagamento apenas).
  let primeiraForma: string | null = null

  const parcelas = fps.map((fp) => {
    const fpAny = fp as unknown as { parcela?: PRow | PRow[] }
    const pRaw = fpAny.parcela
    const p: PRow | undefined = pRaw
      ? Array.isArray(pRaw) ? pRaw[0] : pRaw
      : undefined
    const vnd = p?.venda
      ? Array.isArray(p.venda) ? p.venda[0] : p.venda
      : null

    if (!primeiraForma && p?.forma_pagamento) primeiraForma = p.forma_pagamento

    const vendaProdutosRaw = vnd?.venda_produtos
      ? Array.isArray(vnd.venda_produtos) ? vnd.venda_produtos : [vnd.venda_produtos]
      : []

    const produtos = vendaProdutosRaw
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((pr) => {
        const produto = (pr.tipo_produto_nome ?? "").trim() || "Produto"

        let datasViagem: string | null = null
        if (pr.data_inicio_viagem || pr.data_fim_viagem) {
          datasViagem = `${fmtBR(pr.data_inicio_viagem ?? null)} → ${fmtBR(pr.data_fim_viagem ?? null)}`
        }

        let camposExtras: string | null = null
        const extras = pr.valores_extras ?? {}
        const partes: string[] = []
        for (const [campoId, raw] of Object.entries(extras)) {
          if (raw == null) continue
          const valor = String(raw).trim()
          if (!valor) continue
          partes.push(`${campoNomeById.get(campoId) ?? campoId}: ${valor}`)
        }
        if (partes.length > 0) camposExtras = partes.join(" · ")

        return { produto, datasViagem, camposExtras }
      })

    // Fallback se a venda não tem produtos
    const produtosFinal = produtos.length > 0
      ? produtos
      : [{ produto: p?.descricao ?? "Cobrança da venda", datasViagem: null, camposExtras: null }]

    return {
      descricao: vnd?.identificador ?? (p?.descricao ?? "Parcela"),
      numeroParcela: `${p?.numero ?? 1}/${p?.total_parcelas ?? 1}`,
      dataVencimento: fmtBR(p?.data_vencimento ?? null),
      valor: Number(p?.valor ?? 0),
      produtos: produtosFinal,
    }
  })

  const empresaNome = eRaw?.nome ?? "—"
  const empresaCor = eRaw?.cor_primaria ?? "#1498D5"
  const hoje = new Date().toISOString().slice(0, 10)
  const valorTotal = Number(fatura.valor_total ?? 0)

  const data: FaturaAgrupadaData = {
    empresaNome,
    empresaCor,
    empresaSlug: eRaw?.slug ?? "",
    empresaLogoPath: eRaw?.logo_path ?? null,
    faturaNumero: fatura.numero_display,
    dataEmissao: fatura.data_emissao ?? hoje,
    cliente: {
      nome: cRaw?.nome ?? "—",
      cpf: cRaw?.cpf ?? null,
      cnpj: cRaw?.cnpj ?? null,
      email: cRaw?.email ?? null,
      telefone: cRaw?.telefone ?? null,
    },
    parcelas,
    valorTotal,
    instrucaoPagamento: instrucaoPagamento(primeiraForma, empresaNome),
    pix: null,
    dadosBancarios: null,
  }

  const cnpjFormatado = eRaw?.cnpj ?? null
  const cidadeEmpresa = eRaw?.cidade ?? null
  if (cnpjFormatado && cidadeEmpresa) {
    try {
      const cnpjDigits = cnpjFormatado.replace(/\D/g, "")
      const { gerarPixBRCode } = await import("@/lib/utils/pix-brcode")
      const QRCode = await import("qrcode")
      const brCode = gerarPixBRCode({
        chave: cnpjDigits,
        nome: eRaw?.razao_social ?? empresaNome,
        cidade: cidadeEmpresa,
        valor: valorTotal,
        txid: data.faturaNumero.replace(/[^A-Za-z0-9]/g, "").slice(0, 25),
      })
      const qrDataUrl = await QRCode.default.toDataURL(brCode, {
        type: "image/png", width: 320, margin: 1, errorCorrectionLevel: "M",
        color: { dark: "#1A1F4D", light: "#FFFFFF" },
      })
      data.pix = { chave: cnpjDigits, chaveLabel: `CNPJ ${cnpjFormatado}`, qrDataUrl, brCode }
    } catch { /* sem QR */ }
  }

  if (eRaw?.banco_nome && eRaw.banco_agencia && eRaw.banco_conta) {
    data.dadosBancarios = {
      banco: eRaw.banco_nome,
      agencia: eRaw.banco_agencia,
      conta: eRaw.banco_conta,
      titular: eRaw.razao_social ?? empresaNome,
      cnpjTitular: cnpjFormatado ?? "—",
    }
  }

  return { data, logoPath: eRaw?.logo_path ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Texto orientativo por forma de pagamento. V1 traz placeholders — em
 * versões futuras isso pode vir da configuração da empresa (chave PIX
 * cadastrada, dados bancários etc).
 */
function instrucaoPagamento(forma: string | null, empresa: string): string | null {
  switch (forma) {
    case "pix":
      return `Realize o PIX para a chave cadastrada da ${empresa}. Use o nº da venda como identificador da transferência.`
    case "boleto":
      return `O boleto será enviado por e-mail. Em caso de não recebimento, entre em contato com o atendimento ${empresa}.`
    case "transferencia":
      return `Solicite os dados bancários ao seu atendente ${empresa} para efetuar a transferência. Use o nº da venda como identificador.`
    case "cartao_credito":
      return `O agente enviará um link de pagamento por cartão de crédito.`
    case "cartao_debito":
      return `Pagamento agendado para débito automático na data de vencimento.`
    case "dinheiro":
      return `Pagamento em espécie diretamente ao atendente ${empresa}.`
    case "faturado":
      return `Cobrança incluída na fatura mensal — consulte o ciclo de faturamento.`
    default:
      return null
  }
}
