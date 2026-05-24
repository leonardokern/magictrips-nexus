import type { CurrentUser, Permissoes } from "./use-current-user"

export type Modulo =
  | "dashboard"
  | "clientes"
  | "vendas"
  | "financeiro"
  | "cartoes"
  | "fornecedores"
  | "tipos_produto"
  | "usuarios"
  | "perfis"
  | "comissoes"
  | "auditoria"
  | "exportar"

export type Acao =
  | "ler"
  | "ver"
  | "criar"
  | "editar"
  | "excluir"
  | "aprovar"
  | "csv"
  | "excel"

/**
 * Verifica se um perfil tem permissão para uma ação em um módulo.
 *
 * Administrador sempre retorna true (bypass). Para os demais, lê o JSONB
 * `permissoes` do perfil (formato: { modulo: { acao: bool } }).
 */
export function can(
  user: CurrentUser | null,
  modulo: Modulo,
  acao: Acao,
): boolean {
  if (!user) return false
  if (user.perfil.nome === "Administrador") return true
  return user.perfil.permissoes?.[modulo]?.[acao] ?? false
}

/**
 * Helper para builder de regras compostas — usado em UIs onde múltiplas
 * permissões precisam ser checadas (ex: sidebar).
 */
export function buildPermissions(user: CurrentUser | null) {
  return {
    can: (modulo: Modulo, acao: Acao) => can(user, modulo, acao),
    isAdministrador: user?.perfil.nome === "Administrador",
    isGerente: user?.perfil.nome === "Gerente",
    isAgente: user?.perfil.nome === "Agente",
  }
}

// Re-export para conveniência
export type { Permissoes }
