import { z } from "zod"
import { emailValido } from "@/lib/utils/validators"

/**
 * Schema canônico de usuário (create + edit).
 * Senha NÃO está aqui — é gerada pelo Server Action e retornada ao admin
 * pra cópia manual. Iniciais são auto-derivadas do nome (não exposto na UI).
 */
export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(emailValido, "E-mail inválido"),
  perfil_id: z.string().uuid("Perfil inválido"),
  empresa_ids: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos uma empresa"),
  /**
   * Senha definida pelo admin. Mínimo 8 caracteres.
   * Pode ser gerada via botão "Gerar senha" na UI.
   */
  senha: z
    .string()
    .min(8, "A senha precisa ter no mínimo 8 caracteres")
    .max(72, "Máximo 72 caracteres (limite bcrypt)"),
  /**
   * Quando true, o usuário precisa trocar a senha no primeiro login.
   * Quando false, a senha definida pelo admin já é a senha final.
   */
  forcar_troca_senha: z.boolean().default(true),
})

/**
 * Schema de atualização: todos os campos opcionais (PATCH semântico).
 * `senha`/`forcar_troca_senha` ficam fora do update — senha só muda via
 * `resetarSenha` ou `alterarMinhaSenha`. Email tampouco é editável aqui
 * (mexer em `auth.users.email` exige fluxo especial).
 */
export const usuarioUpdateSchema = z.object({
  nome: usuarioCreateSchema.shape.nome.optional(),
  perfil_id: usuarioCreateSchema.shape.perfil_id.optional(),
  empresa_ids: usuarioCreateSchema.shape.empresa_ids.optional(),
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

export const meuPerfilSenhaSchema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha atual"),
    nova_senha: z
      .string()
      .min(6, "A nova senha deve ter no mínimo 6 caracteres")
      .max(72, "Máximo 72 caracteres")
      .refine((s) => /[A-Z]/.test(s), "Deve conter pelo menos uma letra maiúscula")
      .refine((s) => /[a-z]/.test(s), "Deve conter pelo menos uma letra minúscula")
      .refine((s) => /[0-9]/.test(s), "Deve conter pelo menos um número")
      .refine((s) => /[^A-Za-z0-9]/.test(s), "Deve conter pelo menos um caractere especial"),
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

/**
 * Schema para redefinição de senha via link (sem senha atual).
 * Mesmo critério de complexidade do meuPerfilSenhaSchema.
 */
export const redefinirSenhaSchema = z
  .object({
    nova_senha: z
      .string()
      .min(6, "A nova senha deve ter no mínimo 6 caracteres")
      .max(72, "Máximo 72 caracteres")
      .refine((s) => /[A-Z]/.test(s), "Deve conter pelo menos uma letra maiúscula")
      .refine((s) => /[a-z]/.test(s), "Deve conter pelo menos uma letra minúscula")
      .refine((s) => /[0-9]/.test(s), "Deve conter pelo menos um número")
      .refine((s) => /[^A-Za-z0-9]/.test(s), "Deve conter pelo menos um caractere especial"),
    confirmar_senha: z.string(),
  })
  .refine((v) => v.nova_senha === v.confirmar_senha, {
    message: "As senhas não coincidem",
    path: ["confirmar_senha"],
  })

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>
export type MeuPerfilSenhaInput = z.infer<typeof meuPerfilSenhaSchema>
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>
