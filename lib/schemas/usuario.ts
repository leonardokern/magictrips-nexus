import { z } from "zod"
import { emailValido } from "@/lib/utils/validators"

/**
 * Schema canônico de usuário (create + edit).
 * Senha NÃO está aqui — é gerada pelo Server Action e retornada ao admin
 * pra cópia manual.
 */
export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(emailValido, "E-mail inválido"),
  perfil_id: z.string().uuid("Perfil inválido"),
  empresa_id: z.string().uuid().nullable(),
  iniciais: z
    .string()
    .trim()
    .max(4, "Máximo 4 caracteres")
    .optional()
    .or(z.literal("")),
  comissao_percentual: z
    .number({ invalid_type_error: "Use apenas números" })
    .min(0, "Mínimo 0")
    .max(100, "Máximo 100")
    .nullable()
    .optional(),
})

export const usuarioUpdateSchema = usuarioCreateSchema.partial({
  email: true, // email não é editável depois (mexer em auth.users.email é especial)
})

export const alterarSenhaSchema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha atual"),
    nova_senha: z
      .string()
      .min(8, "A nova senha deve ter no mínimo 8 caracteres")
      .max(72, "Máximo 72 caracteres (limite bcrypt)"),
    confirmar_senha: z.string(),
  })
  .refine((v) => v.nova_senha === v.confirmar_senha, {
    message: "As senhas não coincidem",
    path: ["confirmar_senha"],
  })
  .refine((v) => v.senha_atual !== v.nova_senha, {
    message: "A nova senha deve ser diferente da atual",
    path: ["nova_senha"],
  })

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>
