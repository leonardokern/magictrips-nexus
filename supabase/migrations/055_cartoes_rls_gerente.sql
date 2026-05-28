-- =============================================================================
-- 055 — Cartões: RLS de escrita também para Gerente
-- =============================================================================
-- A policy `cartoes_admin_write` (migration 012) restringia INSERT/UPDATE/DELETE
-- apenas a Administrador. O Gerente, mesmo tendo `cartoes.{ler,criar,editar,
-- excluir}` no JSONB do perfil, era barrado no RLS — o que dava 0 linhas
-- afetadas silenciosamente no UPDATE (sem mensagem de erro útil na UI).
--
-- Padrão consistente com parcelas_receber/parcelas_pagar: Administrador OU
-- Gerente podem escrever, sempre filtrando pela empresa do usuário.
--
-- Defesa em profundidade: o Server Action continua checando
-- `can(user, 'cartoes', '<acao>')` antes de chamar o banco, então perfis
-- customizados sem a permissão são barrados no app mesmo que o RLS passe.
-- =============================================================================

DROP POLICY IF EXISTS cartoes_admin_write ON cartoes;

CREATE POLICY cartoes_write ON cartoes
  FOR ALL TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  )
  WITH CHECK (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );
