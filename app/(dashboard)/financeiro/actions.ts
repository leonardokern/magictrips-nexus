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
      id, venda_id, numero, total_parcelas, descricao, valor, forma_pagamento,
      data_vencimento, data_pagamento, status,
      cliente:clientes(nome, cpf, cnpj, email, telefone),
      venda:vendas(
        identificador, data_venda,
        empresa:empresas(nome, slug, cor_primaria, logo_path, cnpj, cidade, razao_social, banco_nome, banco_agencia, banco_conta)
      )
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
