-- =============================================================================
-- 055 — RLS de tipos_produto / campos_extra por permissão JSONB
-- =============================================================================
-- Bug: as policies criadas em 012_rls.sql exigiam `is_administrador()` pra
-- qualquer escrita em tipos_produto, campos_extra, campos_extra_opcoes e
-- tipos_produto_campos. Isso bloqueia o **Gerente**, que tem permissão
-- `tipos_produto.editar = true` no JSONB e UI mostra os botões — mas o
-- UPDATE/INSERT afeta 0 linhas silenciosamente (RLS bloqueia sem erro).
-- Resultado prático: gerente clica "Salvar", recebe toast de sucesso, mas
-- nada é persistido.
--
-- Solução: alinhar a RLS ao modelo de permissões. Criamos um helper genérico
-- `has_permissao(modulo, acao)` que confere a JSONB do perfil (com bypass
-- automático pra Administrador) e usamos em todas as 4 policies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: has_permissao(modulo, acao) — confere o JSONB do perfil do
--    usuário logado. Administrador sempre retorna true.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION has_permissao(modulo text, acao text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        p.nome = 'Administrador'
        OR COALESCE((p.permissoes #> ARRAY[modulo, acao])::boolean, false) = true
      )
  )
$$;

COMMENT ON FUNCTION has_permissao(text, text) IS
  'Verifica se o usuário autenticado tem permissão JSONB modulo.acao. Administrador sempre true. Use em policies RLS de tabelas administrativas.';

-- Hardening: bloqueia execução anônima (alinhado ao 052)
REVOKE EXECUTE ON FUNCTION public.has_permissao(text, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_permissao(text, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Substituir policies de escrita das 4 tabelas administrativas
-- ─────────────────────────────────────────────────────────────────────────────

-- tipos_produto
DROP POLICY IF EXISTS tipos_produto_admin_write ON tipos_produto;
CREATE POLICY tipos_produto_write_criar ON tipos_produto
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('tipos_produto', 'criar'));
CREATE POLICY tipos_produto_write_editar ON tipos_produto
  FOR UPDATE TO authenticated
  USING (has_permissao('tipos_produto', 'editar'))
  WITH CHECK (has_permissao('tipos_produto', 'editar'));
CREATE POLICY tipos_produto_write_excluir ON tipos_produto
  FOR DELETE TO authenticated
  USING (has_permissao('tipos_produto', 'excluir'));

-- campos_extra
DROP POLICY IF EXISTS campos_extra_admin_write ON campos_extra;
CREATE POLICY campos_extra_write_criar ON campos_extra
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('tipos_produto', 'criar'));
CREATE POLICY campos_extra_write_editar ON campos_extra
  FOR UPDATE TO authenticated
  USING (has_permissao('tipos_produto', 'editar'))
  WITH CHECK (has_permissao('tipos_produto', 'editar'));
CREATE POLICY campos_extra_write_excluir ON campos_extra
  FOR DELETE TO authenticated
  USING (has_permissao('tipos_produto', 'excluir'));

-- campos_extra_opcoes — opções do dropdown seguem mesma permissão de edição
DROP POLICY IF EXISTS campos_extra_opcoes_admin_write ON campos_extra_opcoes;
CREATE POLICY campos_extra_opcoes_write_criar ON campos_extra_opcoes
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('tipos_produto', 'editar'));
CREATE POLICY campos_extra_opcoes_write_editar ON campos_extra_opcoes
  FOR UPDATE TO authenticated
  USING (has_permissao('tipos_produto', 'editar'))
  WITH CHECK (has_permissao('tipos_produto', 'editar'));
CREATE POLICY campos_extra_opcoes_write_excluir ON campos_extra_opcoes
  FOR DELETE TO authenticated
  USING (has_permissao('tipos_produto', 'editar'));

-- tipos_produto_campos — junction segue permissão de edição
DROP POLICY IF EXISTS tipos_produto_campos_admin_write ON tipos_produto_campos;
CREATE POLICY tipos_produto_campos_write_criar ON tipos_produto_campos
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('tipos_produto', 'editar'));
CREATE POLICY tipos_produto_campos_write_editar ON tipos_produto_campos
  FOR UPDATE TO authenticated
  USING (has_permissao('tipos_produto', 'editar'))
  WITH CHECK (has_permissao('tipos_produto', 'editar'));
CREATE POLICY tipos_produto_campos_write_excluir ON tipos_produto_campos
  FOR DELETE TO authenticated
  USING (has_permissao('tipos_produto', 'editar'));
