-- =============================================================================
-- 051 — RLS em fornecedor_tipos_produto
-- =============================================================================
-- A migration 047 criou a tabela sem habilitar RLS, deixando-a exposta
-- via PostgREST sem controle de acesso. Esta migration corrige isso
-- seguindo o mesmo padrão das demais tabelas de catálogo do sistema.
-- =============================================================================

ALTER TABLE fornecedor_tipos_produto ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler (necessário para o wizard de venda)
CREATE POLICY ftp_select ON fornecedor_tipos_produto
  FOR SELECT TO authenticated
  USING (true);

-- Apenas Administrador pode inserir, atualizar ou deletar
CREATE POLICY ftp_admin_write ON fornecedor_tipos_produto
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());
