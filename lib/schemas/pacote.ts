import { z } from "zod"

export const TIPOS_PACOTE = ["unica_operadora", "multi_operadora"] as const
export type TipoPacote = (typeof TIPOS_PACOTE)[number]

export const TIPO_PACOTE_LABEL: Record<TipoPacote, string> = {
  unica_operadora: "Única operadora",
  multi_operadora: "Multi operadoras",
}

/** Uma opção de fornecedor/custo para um item de pacote multi-operadora. */
export const pacoteItemFornecedorSchema = z.object({
  id: z.string().uuid().optional(),
  fornecedor_id: z.string().uuid(),
  valor_custo: z.number().positive("Custo deve ser maior que zero"),
  ordem: z.number().int().min(0).default(0),
})

/** Um item (produto) do pacote — checklist informativo em única operadora,
 *  ou linha financeira completa (com 1+ fornecedores) em multi operadoras. */
export const pacoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  ordem: z.number().int().min(0).default(0),
  tipo_produto_id: z.string().uuid(),
  descricao: z.string().trim().max(150).optional().nullable(),
  valores_extras: z.record(z.string(), z.string()).default({}),
  /** Só relevante quando o pacote pai é multi_operadora. */
  fornecedores: z.array(pacoteItemFornecedorSchema).default([]),
})

export const pacoteSchema = z
  .object({
    empresa_id: z.string().uuid(),
    nome: z.string().trim().min(2, "Nome muito curto").max(150, "Nome muito longo"),
    descricao: z.string().trim().max(500).optional().nullable(),
    tipo_pacote: z.enum(TIPOS_PACOTE),
    data_inicio_viagem: z.string().min(1, "Data de início obrigatória"),
    data_fim_viagem: z.string().min(1, "Data de fim obrigatória"),
    // única operadora
    tipo_produto_id: z.string().uuid().optional().nullable(),
    fornecedor_id: z.string().uuid().optional().nullable(),
    valor_custo_total: z.number().positive().optional().nullable(),
    valores_extras: z.record(z.string(), z.string()).default({}),
    // itens (checklist em única operadora, itens financeiros em multi operadoras)
    itens: z.array(pacoteItemSchema).default([]),
  })
  .refine((v) => v.data_fim_viagem > v.data_inicio_viagem, {
    message: "Data de fim precisa ser depois da data de início",
    path: ["data_fim_viagem"],
  })
  .refine(
    (v) =>
      v.tipo_pacote !== "unica_operadora" ||
      (!!v.tipo_produto_id && !!v.fornecedor_id && !!v.valor_custo_total),
    {
      message: "Operadora e custo total são obrigatórios em pacotes de única operadora.",
      path: ["fornecedor_id"],
    },
  )
  // Um pacote precisa de ao menos 2 produtos — com 1 só não é "pacote".
  .refine((v) => v.itens.length >= 2, {
    message: "Adicione ao menos 2 produtos para formar um pacote.",
    path: ["itens"],
  })
  .refine(
    (v) =>
      v.tipo_pacote !== "multi_operadora" ||
      v.itens.every((i) => i.fornecedores.length >= 1),
    {
      message: "Cada item precisa de ao menos um fornecedor com custo definido.",
      path: ["itens"],
    },
  )

export type PacoteItemFornecedorInput = z.infer<typeof pacoteItemFornecedorSchema>
export type PacoteItemInput = z.infer<typeof pacoteItemSchema>
export type PacoteFormValues = z.infer<typeof pacoteSchema>
