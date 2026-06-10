import { z } from "zod"
import { todasPermissoesValidas } from "@/lib/constants/permissoes"

const PERMS_VALIDAS = todasPermissoesValidas()

export const permissoesSchema = z.record(
  z.string(),
  z.record(z.string(), z.boolean()),
)
export type PermissoesValue = z.infer<typeof permissoesSchema>

export const PERFIL_TIPOS = ["operacao", "agente", "marketing"] as const
export type PerfilTipo = (typeof PERFIL_TIPOS)[number]

/**
 * Override de comissão por origem — só persistido em perfis tipo='agente'
 * e somente quando o valor difere do default da empresa.
 */
export const perfilComissaoOverrideSchema = z.object({
  origem_id: z.string().uuid(),
  percentual: z.number().min(0).max(100),
})
export type PerfilComissaoOverride = z.infer<typeof perfilComissaoOverrideSchema>

/**
 * Regras de escopo:
 *   tipo='operacao' → empresa_id obrigatoriamente null
 *   tipo='agente'   → empresa_id obrigatoriamente uuid
 */
const baseShape = {
  nome: z.string().trim().min(2, "Nome muito curto").max(60, "Nome muito longo"),
  tipo: z.enum(PERFIL_TIPOS),
  empresa_id: z.string().uuid("Empresa inválida").nullable(),
  permissoes: permissoesSchema,
  /** Overrides de comissão (somente agente). */
  comissoes: z.array(perfilComissaoOverrideSchema).optional(),
}

export const perfilCreateSchema = z
  .object(baseShape)
  .refine(
    (v) => (v.tipo === "agente" ? v.empresa_id !== null : v.empresa_id === null),
    {
      message:
        "Perfis tipo Agente precisam de uma empresa; Operação e Marketing são sempre cross-empresa.",
      path: ["empresa_id"],
    },
  )

export const perfilUpdateSchema = z
  .object({
    nome: z.string().trim().min(2).max(60).optional(),
    tipo: z.enum(PERFIL_TIPOS).optional(),
    empresa_id: z.string().uuid().nullable().optional(),
    permissoes: permissoesSchema.optional(),
    comissoes: z.array(perfilComissaoOverrideSchema).optional(),
  })
  .refine(
    (v) => {
      if (v.tipo === undefined) return true
      return v.tipo === "agente"
        ? v.empresa_id !== null && v.empresa_id !== undefined
        : v.empresa_id === null || v.empresa_id === undefined
    },
    {
      message:
        "Perfis tipo Agente precisam de uma empresa; Operação é sempre cross-empresa.",
      path: ["empresa_id"],
    },
  )

export function sanitizarPermissoes(input: PermissoesValue): PermissoesValue {
  const out: PermissoesValue = {}
  for (const [modulo, acoes] of Object.entries(input ?? {})) {
    if (!acoes || typeof acoes !== "object") continue
    const moduloLimpo: Record<string, boolean> = {}
    for (const [acao, val] of Object.entries(acoes)) {
      if (PERMS_VALIDAS.has(`${modulo}.${acao}`)) {
        moduloLimpo[acao] = Boolean(val)
      }
    }
    if (Object.keys(moduloLimpo).length > 0) {
      out[modulo] = moduloLimpo
    }
  }
  return out
}

export type PerfilCreateInput = z.infer<typeof perfilCreateSchema>
export type PerfilUpdateInput = z.infer<typeof perfilUpdateSchema>
