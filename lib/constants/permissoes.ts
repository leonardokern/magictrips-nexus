import type { Modulo, Acao } from "@/lib/hooks/use-permissions"

/**
 * Catálogo declarativo de módulos e suas ações disponíveis.
 *
 * Single source of truth: a UI granular de perfis usa este catálogo para
 * renderizar a grade de checkboxes. O Server Action de update valida que
 * apenas pares (modulo, acao) existentes neste catálogo são aceitos.
 *
 * Para adicionar uma permissão nova:
 *   1. Adicione o módulo aqui (com suas ações) — se ainda não existe.
 *   2. Adicione o tipo correspondente em lib/hooks/use-permissions.ts.
 *   3. Crie uma migration UPDATE em perfis_acesso adicionando a permissão
 *      aos perfis que devem ter (ver migrations 001/014 como modelo).
 *   4. Use can(user, modulo, acao) nos pontos de checagem.
 */

export type AcaoDef = {
  key: Acao
  label: string
  /** Descrição opcional pra tooltip — usar quando a ação tem nuance. */
  hint?: string
}

export type ModuloDef = {
  key: Modulo
  label: string
  /** Resumo do que o módulo faz, exibido no header da seção do editor. */
  description: string
  acoes: AcaoDef[]
  /**
   * Marca o módulo como "ainda não disponível na V1". O editor de perfis
   * renderiza a linha em estado desabilitado (visual + interação) e exibe
   * um badge "Em breve". O catálogo continua existindo (e o `can()` segue
   * funcionando) pra quando o módulo for ativado.
   */
  naoDisponivel?: boolean
}

const CRUD_BASE: AcaoDef[] = [
  { key: "ler", label: "Ler" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
]

export const MODULOS_PERMISSAO: ModuloDef[] = [
  {
    key: "dashboard",
    label: "Dashboards",
    description:
      "Painéis e indicadores da home (contas a receber/pagar, fluxo de caixa, etc.). Sem essa permissão, o usuário vê só uma versão simplificada da tela inicial.",
    acoes: [{ key: "ver", label: "Ver" }],
  },
  {
    key: "clientes",
    label: "Clientes",
    description: "Cadastro e gestão de clientes (regulares e faturados).",
    acoes: CRUD_BASE,
  },
  {
    key: "propostas",
    label: "Propostas",
    description: "Criação de propostas comerciais com PDF executivo para clientes e prospects.",
    acoes: CRUD_BASE,
  },
  {
    key: "vendas",
    label: "Vendas",
    description: "Relatório de venda, ciclo de aprovação, cancelamento.",
    acoes: [
      ...CRUD_BASE,
      {
        key: "aprovar",
        label: "Aprovar",
        hint: "Permite aprovar vendas submetidas e gerar parcelas (Gerente/Administrador).",
      },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Contas a receber, contas a pagar, fluxo de caixa, clientes faturados.",
    acoes: CRUD_BASE,
    naoDisponivel: true,
  },
  {
    key: "cartoes",
    label: "Cartões da agência",
    description: "Cartões de crédito usados para pagar fornecedores.",
    acoes: CRUD_BASE,
  },
  {
    key: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro de fornecedores (CNPJ único) usados nas vendas.",
    acoes: CRUD_BASE,
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Calendário unificado: contas a receber, cartões, viagens, lembretes e notas manuais.",
    acoes: CRUD_BASE,
  },
  {
    key: "tipos_produto",
    label: "Tipos de produto",
    description: "Tipos (Aéreo, Hotel, etc.) e campos dinâmicos por tipo.",
    acoes: CRUD_BASE,
  },
  {
    key: "usuarios",
    label: "Usuários",
    description: "Cadastro de usuários do sistema e atribuição de perfis.",
    acoes: CRUD_BASE,
  },
  {
    key: "perfis",
    label: "Perfis de acesso",
    description: "Gestão dos perfis e suas permissões granulares.",
    acoes: CRUD_BASE,
  },
  {
    key: "comissoes",
    label: "Comissões",
    description: "Matriz de % de comissão por empresa × origem do lead.",
    acoes: [
      { key: "ler", label: "Ler" },
      { key: "editar", label: "Editar" },
    ],
  },
  {
    key: "auditoria",
    label: "Auditoria",
    description: "Log imutável de ações críticas — ver logs por usuário.",
    acoes: [{ key: "ver", label: "Permitir" }],
  },
  {
    key: "exportar",
    label: "Exportações",
    description: "Geração de arquivos para o Otoos e relatórios.",
    // Apenas uma permissão booleana: ou tem ou não tem acesso a exportações.
    // A granularidade por formato (csv/excel) foi removida — todo formato
    // disponível fica liberado quando essa permissão estiver ativa.
    acoes: [{ key: "ver", label: "Permitir" }],
    naoDisponivel: true,
  },
]

/**
 * Retorna todas as combinações (modulo, acao) como pares — útil pra
 * validação no Server Action.
 */
export function todasPermissoesValidas(): Set<string> {
  const out = new Set<string>()
  for (const m of MODULOS_PERMISSAO) {
    for (const a of m.acoes) {
      out.add(`${m.key}.${a.key}`)
    }
  }
  return out
}

/**
 * Gera um JSONB com TODAS as permissões setadas para `value`.
 * Usado pra "Administrador" (sempre true) e pra defaults de novos perfis (false).
 */
export function permissoesTodas(value: boolean) {
  const out: Record<string, Record<string, boolean>> = {}
  for (const m of MODULOS_PERMISSAO) {
    out[m.key] = {}
    for (const a of m.acoes) {
      out[m.key]![a.key] = value
    }
  }
  return out
}
