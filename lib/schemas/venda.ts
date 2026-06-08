import { z } from "zod"
import { emailValido } from "@/lib/utils/validators"

// ─────────────────────────────────────────────────────────────────────────────
// Cliente novo (quando admin escolhe "Outro" no combobox)
// ─────────────────────────────────────────────────────────────────────────────

export const clienteNovoBasicoSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().refine(emailValido, "E-mail inválido"),
  telefone: z.string().min(10, "Telefone inválido"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
  data_nascimento: z.string().optional().nullable(),
  tipo: z.enum(["regular", "faturado"]).default("regular"),
  dia_faturamento: z.number().int().min(1).max(31).optional().nullable(),
})

export type ClienteNovoBasicoInput = z.infer<typeof clienteNovoBasicoSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Produto da venda
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Como a Magic paga o fornecedor por um produto. Três cenários:
 *
 *  - `faturado` — Fornecedor desconta das comissões pendentes com a Magic;
 *    se não tem comissão suficiente, gera uma fatura direta com a Magic.
 *    Fluxo externo, V1 só registra a forma.
 *  - `cartao_agencia` — Magic paga com cartão próprio (controla parcelas,
 *    vencimento, contas a pagar futuro). Forma "Cartão" do modelo antigo.
 *  - `cartao_cliente` — Fornecedor gera um link de pagamento direto pro
 *    cliente. Magic só recebe a comissão. Não há cobrança nem pagamento
 *    nosso pra registrar — o Step 3 (Cobrança) é dispensado quando TODOS
 *    os produtos são `cartao_cliente`.
 */
export const PGTO_FORMAS = ["faturado", "cartao_agencia", "cartao_cliente"] as const
export type PgtoForma = (typeof PGTO_FORMAS)[number]

export const PGTO_FORMA_LABEL: Record<PgtoForma, string> = {
  faturado: "Faturado",
  cartao_agencia: "Cartão Agência",
  cartao_cliente: "Cartão Cliente",
}

export const TIPOS_COMISSAO = ["comissionado", "net", "incentivado"] as const
export type TipoComissao = (typeof TIPOS_COMISSAO)[number]

export const TIPO_COMISSAO_LABEL: Record<TipoComissao, string> = {
  comissionado: "Comissionado",
  net: "Net",
  incentivado: "Incentivado",
}

export const vendaProdutoSchema = z.object({
  ordem: z.number().int().min(1).default(1),
  tipo_produto_id: z.string().uuid("Tipo de produto inválido"),
  fornecedor_id: z.string().uuid().nullable().optional(),
  fornecedor_nome: z.string().trim().max(120).default(""),
  localizador: z.string().trim().max(60).nullable().optional(),
  localizador_fornecedor: z.string().trim().max(60).nullable().optional(),
  destino: z.string().trim().max(120).nullable().optional(),
  /** Data de emissão do produto (ex: emissão do bilhete aéreo).
   *  Conferência operacional, distinta da data_venda. */
  data_emissao: z.string().nullable().optional(),
  data_inicio_viagem: z.string().nullable().optional(),
  data_fim_viagem: z.string().nullable().optional(),
  /** Map campo_id → valor (texto/número/data/boolean) */
  valores_extras: z.record(z.string(), z.any()).default({}),
  tipo_comissao: z.string().nullable().optional(),
  valor_venda: z.number().min(0, "Valor de venda inválido"),
  valor_custo: z.number().min(0, "Valor de custo inválido"),
  rav: z.number().min(0).nullable().optional(),
  rav_extra_cliente: z.number().min(0).default(0),
  rav_extra_fornecedor: z.number().min(0).default(0),
  comissao_vendedor: z.number().min(0).nullable().optional(),
  pgto_modo: z.enum(["comissionado", "net"]).default("comissionado"),
  pgto_forma: z.enum(PGTO_FORMAS).nullable().optional(),
  pgto_cartao_id: z.string().uuid().nullable().optional(),
  pgto_valor_total: z.number().min(0).nullable().optional(),
  pgto_entrada: z.number().min(0).default(0),
  pgto_num_parcelas: z.number().int().min(1).default(1),
  pgto_valor_parcela: z.number().min(0).nullable().optional(),
  pgto_data_debito: z.string().nullable().optional(),
  /** Valor extra embutido na 1ª parcela (taxas etc.). Diluído nas demais. */
  pgto_primeira_parcela_extra: z.number().min(0).default(0),
})

export type VendaProdutoInput = z.infer<typeof vendaProdutoSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Cobrança do cliente
// ─────────────────────────────────────────────────────────────────────────────

export const COBRANCA_TIPOS = [
  "pix",
  "boleto",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "dinheiro",
  "faturado",
  "link_externo",
  "outro",
] as const
export type CobrancaTipo = (typeof COBRANCA_TIPOS)[number]

export const COBRANCA_TIPO_LABEL: Record<CobrancaTipo, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  faturado: "Faturado",
  link_externo: "Link externo (PagSeguro/Cielo)",
  outro: "Outro",
}

/** Distribuição planejada de uma parcela individual (valor + data). */
export const parcelaDetalheSchema = z.object({
  ordem: z.number().int().min(1),
  valor: z.number().min(0),
  data: z.string().nullable().optional(),
})

export const cobrancaItemSchema = z.object({
  tipo: z.enum(COBRANCA_TIPOS),
  valor_total: z.number().min(0),
  num_parcelas: z.number().int().min(1).default(1),
  valor_parcela: z.number().min(0).nullable().optional(),
  /** URL do link de pagamento — usado por `link_externo`. */
  plataforma_link: z.string().trim().max(500).nullable().optional(),
  /** Plataforma do pagamento. Restrito a PagSeguro/Cielo no banco. */
  plataforma: z.enum(["PagSeguro", "Cielo"]).nullable().optional(),
  /** Distribuição planejada das parcelas (vazia em pagamento à vista). */
  parcelas_detalhe: z.array(parcelaDetalheSchema).default([]),
  taxa_adquirente: z.number().min(0).nullable().optional(),
  valor_liquido: z.number().min(0).nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_primeiro_recebimento: z.string().nullable().optional(),
  fornecedor_destino: z.string().trim().max(120).nullable().optional(),
  observacoes: z.string().trim().max(500).nullable().optional(),
  /** Comprovante de pagamento — obrigatório no nível da UI/wizard. */
  comprovante_storage_path: z.string().trim().nullable().optional(),
  comprovante_nome_arquivo: z.string().trim().nullable().optional(),
  comprovante_mime_type: z.string().trim().nullable().optional(),
  comprovante_tamanho_bytes: z.number().int().nonnegative().nullable().optional(),
})

export type ParcelaDetalheInput = z.infer<typeof parcelaDetalheSchema>

export const cobrancaSchema = z.object({
  valor_total: z.number().min(0),
  observacoes: z.string().trim().max(500).nullable().optional(),
  itens: z.array(cobrancaItemSchema).min(1, "Adicione ao menos uma forma de cobrança"),
})

export type CobrancaItemInput = z.infer<typeof cobrancaItemSchema>
export type CobrancaInput = z.infer<typeof cobrancaSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Passageiro
// ─────────────────────────────────────────────────────────────────────────────

export const passageiroSchema = z.object({
  ordem: z.number().int().min(1).default(1),
  nome: z.string().trim().min(0).max(120).default(""),
  cpf: z.string().trim().optional().nullable(),
  data_nascimento: z.string().nullable().optional(),
})

export type PassageiroInput = z.infer<typeof passageiroSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Venda completa
// ─────────────────────────────────────────────────────────────────────────────

export const vendaCreateSchema = z
  .object({
    empresa_id: z.string().uuid("Empresa inválida"),
    data_venda: z.string().min(1, "Data da venda obrigatória"),
    cliente_id: z.string().uuid().nullable().optional(),
    cliente_novo: clienteNovoBasicoSchema.nullable().optional(),
    pax: z.number().int().min(1).default(1),
    origem: z.string().trim().max(120).nullable().optional(),
    indicacao_percentual: z.number().min(0).max(100).nullable().optional(),
    /** Percentual de comissão do agente congelado no momento da venda. */
    comissao_percentual: z.number().min(0).max(100).nullable().optional(),
    observacoes: z.string().trim().max(500).nullable().optional(),
    usuario_id: z.string().uuid().optional(),

    produtos: z.array(vendaProdutoSchema).min(1, "Adicione ao menos um produto"),
    passageiros: z.array(passageiroSchema).default([]),
    cobranca: cobrancaSchema,
  })
  .refine(
    (v) => v.cliente_id !== undefined || v.cliente_novo !== undefined,
    {
      message: "Selecione um cliente existente ou preencha os dados do novo cliente.",
      path: ["cliente_id"],
    },
  )

export type VendaCreateInput = z.infer<typeof vendaCreateSchema>
