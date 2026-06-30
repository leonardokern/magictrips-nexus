-- =============================================================================
-- 053 — Security Hardening 2
-- =============================================================================
-- Corrige avisos do Supabase Advisor sem remover funcionalidade alguma:
--
-- 1. SECURITY DEFINER views (2 ERRORs): venda_produtos_efetivos e vendas_efetivas
--    criadas sem security_invoker=true → rodavam como superuser, contornando RLS.
--    Correção: security_invoker=true → RLS dos usuários passa a valer nas views.
--
-- 2. function_search_path_mutable (4 WARNs): funções criadas sem SET search_path.
--    Sem isso, um schema malicioso no search_path poderia substituir funções base.
--
-- 3. anon_security_definer_function_executable (17 WARNs): a migration 052 tentou
--    REVOKE FROM anon mas PostgreSQL tem EXECUTE em PUBLIC por default — o REVOKE
--    específico de anon não remove herança do PUBLIC. Correção correta:
--    REVOKE FROM PUBLIC + GRANT TO authenticated, service_role.
--
--    Funções de trigger internas: apenas REVOKE FROM PUBLIC (sem GRANT — triggers
--    invocam a função como owner do trigger, sem precisar de EXECUTE explícito).
--
-- 4. Índice duplicado em vendas (1 item).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY INVOKER nas views
-- ─────────────────────────────────────────────────────────────────────────────
-- Sem security_invoker=true, views owned by postgres rodam como superuser
-- (bypassando RLS). Com security_invoker=true, rodam como o usuário chamador,
-- e o RLS das tabelas subjacentes é aplicado normalmente.

ALTER VIEW public.venda_produtos_efetivos SET (security_invoker = true);
ALTER VIEW public.vendas_efetivas        SET (security_invoker = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SET search_path = public — funções sem hardening
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.trg_faturas_set_updated_at()               SET search_path = public;
ALTER FUNCTION public.proximo_numero_fatura(uuid, integer)        SET search_path = public;
ALTER FUNCTION public._tg_calc_desfluxo_via_produto()             SET search_path = public;
ALTER FUNCTION public._tg_calc_desfluxo_via_cobr_item()           SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Funções de trigger internas — REVOKE FROM PUBLIC
--     Chamadas exclusivamente pelo motor de triggers do PostgreSQL (não via REST).
--     Triggers invocam a função como owner, independente de grants ao usuário.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.enforce_empresa_matches_perfil()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_override_apenas_para_agente()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_venda_anexos_limit()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_notificar_compartilhamento_agenda()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_faturas_set_updated_at()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._tg_calc_desfluxo_via_produto()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._tg_calc_desfluxo_via_cobr_item()           FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. RPCs de negócio — REVOKE FROM PUBLIC + GRANT TO authenticated
--     O app chama essas funções via PostgREST com JWT de usuário logado.
--     REVOKE FROM PUBLIC fecha chamadas anônimas; GRANT TO authenticated mantém tudo.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.aprovar_venda(uuid)                                                                FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aprovar_venda(uuid)                                                                TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atualizar_fornecedor(uuid, text, text, text, boolean, smallint, boolean, uuid[])   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.atualizar_fornecedor(uuid, text, text, text, boolean, smallint, boolean, uuid[])   TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atualizar_foto_usuario(uuid, text)                                                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.atualizar_foto_usuario(uuid, text)                                                 TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.comissao_efetiva_perfil(uuid, uuid)                                                FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.comissao_efetiva_perfil(uuid, uuid)                                                TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.compartilham_empresa(uuid)                                                         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compartilham_empresa(uuid)                                                         TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.criar_fornecedor(text, text, text, boolean, smallint, boolean, uuid[])             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.criar_fornecedor(text, text, text, boolean, smallint, boolean, uuid[])             TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.devolver_venda(uuid, uuid, text)                                                   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.devolver_venda(uuid, uuid, text)                                                   TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_pagar(uuid)                                                         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.gerar_parcelas_pagar(uuid)                                                         TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_usuario_completo(uuid)                                                         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_usuario_completo(uuid)                                                         TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_usuarios_ultima_interacao(uuid[])                                              FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_usuarios_ultima_interacao(uuid[])                                              TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_usuarios_ultimo_login(uuid[])                                                  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_usuarios_ultimo_login(uuid[])                                                  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proximo_numero_fatura(uuid, integer)                                               FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.proximo_numero_fatura(uuid, integer)                                               TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.tem_permissao_dashboard()                                                          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.tem_permissao_dashboard()                                                          TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Índice duplicado em vendas
-- ─────────────────────────────────────────────────────────────────────────────
-- idx_vendas_usuario e vendas_usuario_idx cobrem a mesma coluna.
-- Manter idx_vendas_usuario (segue convenção idx_* do projeto).

DROP INDEX IF EXISTS public.vendas_usuario_idx;
