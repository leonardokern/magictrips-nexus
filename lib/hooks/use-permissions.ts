import type { CurrentUser, Permissoes } from "./use-current-user"

export type Modulo =
  | "dashboard"
  | "clientes"
  | "propostas"
  | "vendas"
  | "financeiro"
  | "cartoes"
  | "fornecedores"
  | "agenda"
  | "tipos_produto"
  | "pacotes"
  | "usuarios"
  | "perfis"
  | "comissoes"
  | "auditoria"
  | "exportar"
  | "relatorios"

export type Acao =
  | "ler"
  | "ver"
  | "criar"
  | "editar"
  | "excluir"
  | "aprovar"

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
  // Admin bypass — checa pela CHAVE ESTÁVEL, não pelo nome (que é editável).
  if (user.perfil.chave_sistema === "admin") return true
  return user.perfil.permissoes?.[modulo]?.[acao] ?? false
}

/**
 * Helper para builder de regras compostas — usado em UIs onde múltiplas
 * permissões precisam ser checadas (ex: sidebar). Todas as checagens usam
 * `chave_sistema` (estável), não o nome do perfil (renomeável).
 */
export function buildPermissions(user: CurrentUser | null) {
  return {
    can: (modulo: Modulo, acao: Acao) => can(user, modulo, acao),
    isAdministrador: user?.perfil.chave_sistema === "admin",
    isGerente: user?.perfil.chave_sistema === "gerente",
    isAgente: user?.perfil.chave_sistema === "agente",
  }
}

// Re-export para conveniência
export type { Permissoes }
