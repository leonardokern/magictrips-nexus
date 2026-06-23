import { z } from "zod"

/** Tipos de campo aceitos no catálogo.
 *
 *  - `texto`        → texto longo (campo de largura cheia, ideal pra
 *                     observações, descrições, observações etc.)
 *  - `texto_curto`  → texto curto (campo compacto, ideal pra códigos,
 *                     IDs, localizadores, identificadores etc.) */
export const TIPOS_CAMPO = [
  "texto_curto",
  "texto",
  "numero",
  "valor",
  "data",
  "dropdown",
  "sim_nao",
  "fornecedor",
] as const
export type TipoCampo = (typeof TIPOS_CAMPO)[number]

export const TIPO_CAMPO_LABEL: Record<TipoCampo, string> = {
  texto_curto: "Texto curto",
  texto: "Texto longo",
  numero: "Número",
  valor: "Valor (R$)",
  data: "Data",
  dropdown: "Lista (dropdown)",
  sim_nao: "Sim/Não",
  fornecedor: "Fornecedor",
}

// ── Tipo de Produto ──────────────────────────────────────────────────────────

/** Ícones disponíveis para tipos de produto (filename sem extensão). */
export const ICONES_TIPO_PRODUTO = [
  "001-aviao",
  "002-hotel",
  "003-seguro",
  "004-van-de-campista",
  "005-cruzeiro",
  "006-passaporte",
  "007-carros",
  "008-carga-de-trem",
  "009-ingressos-de-cinema",
  "010-malas",
  "011-cerca-do-parque",
  "013-onibus",
  "018-animal",
  "019-business-trip",
  "020-people",
  "021-map",
  "022-round-trip",
  "023-signboard",
  "024-ticket",
  "025-boat",
  "026-tourist",
  "food-and-restaurant",
  "brinde",
  "assento",
  "patas",
  "kit-de-ferramentas",
  "ferias",
] as const

export const ICONE_LABEL: Record<(typeof ICONES_TIPO_PRODUTO)[number], string> = {
  "001-aviao":              "Avião",
  "002-hotel":              "Hotel",
  "003-seguro":             "Seguro",
  "004-van-de-campista":    "Van / Campista",
  "005-cruzeiro":           "Cruzeiro",
  "006-passaporte":         "Passaporte",
  "007-carros":             "Carro",
  "008-carga-de-trem":      "Trem",
  "009-ingressos-de-cinema":"Ingressos",
  "010-malas":              "Malas",
  "011-cerca-do-parque":    "Parque",
  "013-onibus":             "Ônibus",
  "018-animal":             "Animal",
  "019-business-trip":      "Viagem a negócios",
  "020-people":             "Grupo",
  "021-map":                "Mapa",
  "022-round-trip":         "Ida e volta",
  "023-signboard":          "Placa",
  "024-ticket":             "Ticket",
  "025-boat":               "Barco",
  "026-tourist":            "Turista",
  "food-and-restaurant":    "Restaurante",
  "brinde":                 "Brinde",
  "assento":                "Assento",
  "patas":                  "Pet",
  "kit-de-ferramentas":     "Equipamentos",
  "ferias":                 "Férias",
}

export const tipoProdutoVinculoCampoSchema = z.object({
  campo_id: z.string().uuid(),
  obrigatorio: z.boolean(),
  ordem: z.number().int().min(0),
})

export const tipoProdutoCreateSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo"),
  icone: z.string().nullable().optional(),
  campos: z.array(tipoProdutoVinculoCampoSchema),
})

export const tipoProdutoUpdateSchema = z.object({
  nome: z.string().trim().min(2).max(60).optional(),
  ativo: z.boolean().optional(),
  icone: z.string().nullable().optional(),
  campos: z.array(tipoProdutoVinculoCampoSchema).optional(),
})

export type TipoProdutoVinculoCampo = z.infer<typeof tipoProdutoVinculoCampoSchema>
export type TipoProdutoCreateInput = z.infer<typeof tipoProdutoCreateSchema>
export type TipoProdutoUpdateInput = z.infer<typeof tipoProdutoUpdateSchema>

// ── Campo Extra ──────────────────────────────────────────────────────────────

export const campoOpcaoSchema = z.object({
  /** Pode vir sem id quando é uma opção nova ainda não persistida. */
  id: z.string().uuid().optional(),
  valor: z.string().trim().min(1, "Valor obrigatório").max(80),
  ordem: z.number().int().min(0).default(0),
})

export const campoExtraCreateSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome muito curto").max(60),
    tipo_campo: z.enum(TIPOS_CAMPO),
    placeholder: z.string().trim().max(120).optional().nullable(),
    opcoes: z.array(campoOpcaoSchema).optional(),
  })
  .refine(
    (v) =>
      v.tipo_campo !== "dropdown" || (v.opcoes && v.opcoes.length >= 1),
    {
      message: "Dropdown precisa de ao menos uma opção.",
      path: ["opcoes"],
    },
  )

export const campoExtraUpdateSchema = z
  .object({
    nome: z.string().trim().min(2).max(60).optional(),
    tipo_campo: z.enum(TIPOS_CAMPO).optional(),
    placeholder: z.string().trim().max(120).optional().nullable(),
    ativo: z.boolean().optional(),
    opcoes: z.array(campoOpcaoSchema).optional(),
  })
  .refine(
    (v) =>
      v.tipo_campo === undefined ||
      v.tipo_campo !== "dropdown" ||
      (v.opcoes && v.opcoes.length >= 1),
    {
      message: "Dropdown precisa de ao menos uma opção.",
      path: ["opcoes"],
    },
  )

export type CampoOpcao = z.infer<typeof campoOpcaoSchema>
export type CampoExtraCreateInput = z.infer<typeof campoExtraCreateSchema>
export type CampoExtraUpdateInput = z.infer<typeof campoExtraUpdateSchema>
