import { z } from "zod"
import {
  cnpjValido,
  cpfValido,
  emailValido,
  telefoneValido,
} from "@/lib/utils/validators"
import { onlyDigits } from "@/lib/utils/formatters"

/**
 * Schema canônico de cliente — usado em criar/editar (Server Action + Form).
 *
 * Convenções:
 *  - Documento (CPF/CNPJ) e telefone são SALVOS sem máscara
 *  - dia_faturamento só é exigido se tipo='faturado'
 *  - endereço é jsonb opcional com sub-campos opcionais
 *  - tipo_pessoa controla o conjunto de campos exigidos:
 *      fisica   → nome, cpf, data_nascimento (opcional)
 *      juridica → razao_social, nome_fantasia (opcional), cnpj, responsavel (opcional)
 */

const enderecoSchema = z
  .object({
    rua: z.string().trim().max(200).optional(),
    numero: z.string().trim().max(20).optional(),
    complemento: z.string().trim().max(100).optional(),
    bairro: z.string().trim().max(100).optional(),
    cidade: z.string().trim().max(100).optional(),
    // Para brasileiros: 2 letras (UF). Para estrangeiros: campo livre.
    estado: z.string().trim().max(100).optional().or(z.literal("")),
    // Para brasileiros: 8 dígitos (validado no superRefine). Para estrangeiros: livre.
    cep: z.string().optional(),
    // Código ISO 3166-1 alpha-2 do país (obrigatório para estrangeiros).
    pais: z.string().trim().max(2).optional().or(z.literal("")),
  })
  .partial()

export const tipoPessoaSchema = z.enum(["fisica", "juridica"])
export const tipoClienteSchema = z.enum(["regular", "faturado"])
export const statusClienteSchema = z.enum(["lead", "ativo", "inativo"])

export const clienteBaseSchema = z
  .object({
    empresa_id: z.string().uuid("Empresa inválida"),
    tipo_pessoa: tipoPessoaSchema.default("fisica"),

    // PF
    nome: z.string().trim().max(200).optional().or(z.literal("")),
    cpf: z.string().optional().or(z.literal("")),
    data_nascimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .optional()
      .or(z.literal("")),
    /** Número do passaporte — opcional. PF apenas. Sempre uppercase, máx 10 chars. */
    passaporte: z
      .string()
      .trim()
      .toUpperCase()
      .max(10, "Passaporte aceita até 10 caracteres")
      .optional()
      .or(z.literal("")),

    // PJ
    razao_social: z.string().trim().max(200).optional().or(z.literal("")),
    nome_fantasia: z.string().trim().max(200).optional().or(z.literal("")),
    cnpj: z.string().optional().or(z.literal("")),
    responsavel: z.string().trim().max(200).optional().or(z.literal("")),

    /** true = estrangeiro (sem validação de CPF/CEP, com país obrigatório no endereço). */
    estrangeiro: z.boolean().default(false),

    // Comuns
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine(emailValido, "E-mail inválido"),
    /** DDI salvo como "+55", "+351", etc. Default Brasil. */
    telefone_ddi: z.string().default("+55"),
    /**
     * Número sem o DDI.
     * - Brasil (+55): dígitos apenas (10 ou 11), validado no superRefine.
     * - Internacional: texto livre mín. 4 chars.
     */
    telefone: z.string().min(1, "Telefone obrigatório"),
    endereco: enderecoSchema.optional(),
    origem: z.string().trim().max(100).optional().or(z.literal("")),
    tipo: tipoClienteSchema.default("regular"),
    dia_faturamento: z
      .number()
      .int()
      .min(1, "Mínimo 1")
      .max(31, "Máximo 31")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    status: statusClienteSchema.default("ativo"),
    observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.tipo_pessoa === "fisica") {
      // PF exige nome + data de nascimento. Passaporte é opcional.
      if (!v.nome || v.nome.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nome"],
          message: "Nome muito curto",
        })
      }
      if (v.estrangeiro) {
        // Estrangeiro: documento alfanumérico livre, apenas não-vazio
        if (!v.cpf || v.cpf.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cpf"],
            message: "Documento obrigatório",
          })
        }
      } else {
        // Brasileiro: valida CPF
        const cpfNum = onlyDigits(v.cpf ?? "")
        if (!cpfValido(cpfNum)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cpf"],
            message: "CPF inválido",
          })
        }
      }
      if (!v.data_nascimento || v.data_nascimento === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["data_nascimento"],
          message: "Data de nascimento obrigatória",
        })
      }
    } else {
      // PJ exige razão social + CNPJ válido.
      if (!v.razao_social || v.razao_social.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["razao_social"],
          message: "Razão social obrigatória",
        })
      }
      const cnpjNum = onlyDigits(v.cnpj ?? "")
      if (!cnpjValido(cnpjNum)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cnpj"],
          message: "CNPJ inválido",
        })
      }
    }

    // Telefone: validação condicional pelo DDI
    if (v.telefone_ddi === "+55") {
      if (!telefoneValido(v.telefone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["telefone"],
          message: "Telefone deve ter 10 ou 11 dígitos",
        })
      }
    } else {
      if (v.telefone.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["telefone"],
          message: "Telefone muito curto",
        })
      }
    }

    // CEP: só valida 8 dígitos para brasileiros
    if (!v.estrangeiro) {
      const cepNum = onlyDigits(v.endereco?.cep ?? "")
      if (cepNum !== "" && cepNum.length !== 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endereco", "cep"],
          message: "CEP deve ter 8 dígitos",
        })
      }
    }

    // Estrangeiro exige país no endereço
    if (v.estrangeiro && !v.endereco?.pais) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endereco", "pais"],
        message: "Selecione o país",
      })
    }

    // Cliente faturado exige dia_faturamento
    if (v.tipo === "faturado" && (!v.dia_faturamento || v.dia_faturamento < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dia_faturamento"],
        message: "Cliente faturado exige dia de faturamento",
      })
    }
  })

export type ClienteFormValues = z.infer<typeof clienteBaseSchema>
export type TipoPessoa = z.infer<typeof tipoPessoaSchema>
export type TipoCliente = z.infer<typeof tipoClienteSchema>
export type StatusCliente = z.infer<typeof statusClienteSchema>

/**
 * Labels PT-BR pra exibir nas UIs.
 */
export const TIPO_PESSOA_LABEL: Record<TipoPessoa, string> = {
  fisica: "Pessoa física",
  juridica: "Pessoa jurídica",
}

export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  regular: "Regular",
  faturado: "Faturado",
}

export const STATUS_CLIENTE_LABEL: Record<StatusCliente, string> = {
  lead: "Lead",
  ativo: "Ativo",
  inativo: "Inativo",
}

export const ORIGENS_CLIENTE = [
  "Instagram",
  "Site",
  "Indicação",
  "Manual",
  "Tráfego Pago",
  "Outro",
] as const
