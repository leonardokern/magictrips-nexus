-- =============================================================================
-- 033 — Remove trigger que bloqueava deletar perfis com sistema=true
-- =============================================================================
-- Tinha um trigger DEFENSIVO no banco (`trg_proteger_perfis_sistema_delete`)
-- que impedia DELETE em qualquer linha de `perfis_acesso` com `sistema=true`.
-- Bom em fase de scaffold, mas agora a regra de negócio é mais simples:
--   "só pode excluir se não houver usuários atrelados"
-- — e ela vive na server action `deletePerfil`. O trigger virou redundante e
-- bloqueia exclusão legítima de perfis seed (ex: Agente Del Mondo).
-- =============================================================================

DROP TRIGGER IF EXISTS trg_proteger_perfis_sistema_delete ON perfis_acesso;
DROP FUNCTION IF EXISTS proteger_perfis_sistema();
