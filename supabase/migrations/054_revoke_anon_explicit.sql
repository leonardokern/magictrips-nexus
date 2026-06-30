-- =============================================================================
-- 054 — REVOKE anon explícito
-- =============================================================================
-- As migrations 052 e 053 fizeram REVOKE FROM PUBLIC, mas havia GRANTs explícitos
-- para o role `anon` nas funções criadas antes da migration 013.
-- REVOKE FROM PUBLIC não remove grants explícitos — é necessário REVOKE FROM anon
-- diretamente para cada função ainda listada.
--
-- Funções de trigger: apenas REVOKE FROM anon (triggers rodam como owner).
-- RPCs de negócio: apenas REVOKE FROM anon (GRANT TO authenticated já feito na 053).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Funções de trigger — REVOKE FROM anon
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public._tg_calc_desfluxo_via_cobr_item()     FROM anon;
REVOKE EXECUTE ON FUNCTION public._tg_calc_desfluxo_via_produto()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_flag_marketing()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_faturas_set_updated_at()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_origens_venda_set_updated_at()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_perfis_comissoes_set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_vendas_rascunho_updated_at()   FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs de negócio — REVOKE FROM anon
-- (GRANT TO authenticated já aplicado na migration 053)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.aprovar_venda(uuid)                                                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_fornecedor(uuid, text, text, text, boolean, smallint, boolean, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_fornecedor(text, text, text, boolean, smallint, boolean, uuid[])           FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_pagar(uuid)                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_usuario_completo(uuid)                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_usuarios_ultima_interacao(uuid[])                                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_usuarios_ultimo_login(uuid[])                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.proximo_numero_fatura(uuid, integer)                                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.tem_permissao_dashboard()                                                        FROM anon;
