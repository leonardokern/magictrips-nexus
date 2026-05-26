-- =============================================================================
-- 052 — Security Hardening
-- =============================================================================
-- Corrige dois grupos de warnings do Supabase Advisor:
--
-- 1. REVOKE EXECUTE FROM anon: funções SECURITY DEFINER acessíveis por
--    usuários não autenticados via PostgREST. Na prática falham internamente
--    (verificam auth.uid()), mas não devem nem aceitar a requisição.
--
-- 2. SET search_path = public: funções trigger criadas após a migration 013
--    sem o hardening de search_path que o restante do sistema já possui.
--
-- Funções de trigger internas (enforce_*, trg_*) recebem REVOKE também de
-- `authenticated` pois são invocadas apenas por triggers do banco, nunca
-- diretamente via REST.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REVOKE EXECUTE FROM anon — RPCs de negócio
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.agenda_eh_compartilhado(uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.agenda_eh_dono(uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.aprovar_venda(uuid, uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_foto_usuario(uuid, text)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.comissao_efetiva_perfil(uuid, uuid)    FROM anon;
REVOKE EXECUTE ON FUNCTION public.compartilham_empresa(uuid)             FROM anon;
REVOKE EXECUTE ON FUNCTION public.devolver_venda(uuid, uuid, text)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.editar_venda_completa(uuid, jsonb, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.excluir_venda(uuid, text)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_receber(uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_agenda_eventos(date, date)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_usuarios_para_compartilhar()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.resubmeter_venda(uuid, jsonb)          FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REVOKE EXECUTE FROM anon + authenticated — funções de trigger internas
--    (nunca devem ser chamadas diretamente via REST)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.enforce_empresa_matches_perfil()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_override_apenas_para_agente()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notificar_compartilhamento_agenda()   FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SET search_path = public — trigger functions sem hardening
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.trg_perfis_comissoes_set_updated_at()
  SET search_path = public;

ALTER FUNCTION public.trg_origens_venda_set_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_vendas_rascunho_updated_at()
  SET search_path = public;
