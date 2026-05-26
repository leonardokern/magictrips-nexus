import { z } from "zod"
import { cnpjValido } from "@/lib/utils/validators"
import { onlyDigits } from "@/lib/utils/formatters"

export const tipoFornecedorSchema = z.enum([
  "consolidador",
  "cia_aerea",
  "hotel",
  "operadora",
  "outros",
])

export type TipoFornecedor = z.infer<typeof tipoFornecedorSchema>

export const fornecedorSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(150, "Nome muito longo"),
  cnpj: z
    .string()
    .transform((v) => onlyDigits(v))
    .refine(cnpjValido, "CNPJ inválido"),
  tipo: tipoFornecedorSchema.optional().or(z.literal("")),
  /** IDs dos tipos de produto que este fornecedor atende. */
  tipos_produto_ids: z.array(z.string().uuid()).default([]),
  /** Aceita modo comissionado (RAV extra pago posteriormente pelo fornecedor). */
  modo_comissionado: z.boolean().default(false),
  /** Dia do mês (1–31) em que o fornecedor repassa o RAV extra comissionado. */
  modo_comissionado_dia_pagamento: z
    .number()
    .int()
    .min(1)
    .max(31)
    .nullable()
    .optional(),
  /** Aceita modo NET (RAV extra descontado na hora do pagamento). */
  modo_net: z.boolean().default(false),
})

export type FornecedorFormValues = z.infer<typeof fornecedorSchema>

export const TIPO_FORNECEDOR_LABEL: Record<TipoFornecedor, string> = {
  consolidador: "Consolidador",
  cia_aerea: "Cia. Aérea",
  hotel: "Hotel",
  operadora: "Operadora",
  outros: "Outros",
}

export const TIPOS_FORNECEDOR_OPCOES: { value: TipoFornecedor; label: string }[] = [
  { value: "consolidador", label: "Consolidador" },
  { value: "cia_aerea", label: "Cia. Aérea" },
  { value: "hotel", label: "Hotel" },
  { value: "operadora", label: "Operadora" },
  { value: "outros", label: "Outros" },
]
