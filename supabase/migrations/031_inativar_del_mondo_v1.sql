-- =============================================================================
-- 031 — Inativar Del Mondo para a V1
-- =============================================================================
-- A V1 do Nexus opera apenas com a Magic Trips. Del Mondo fica preservada
-- no banco (com todos os FKs existentes intactos), apenas some das listagens
-- que filtram por `ativo = true` — perfis, usuarios, comissoes, dashboard,
-- empresa selector.
--
-- Reverter (quando a operação Del Mondo voltar):
--   UPDATE empresas SET ativo = true WHERE slug = 'del-mondo';
-- =============================================================================

UPDATE empresas SET ativo = false WHERE slug = 'del-mondo';
