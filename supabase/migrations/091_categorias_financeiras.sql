-- Categorias financeiras para lançamentos manuais (tipo Otoos "Categoria Financeira")
CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id) ON DELETE CASCADE,  -- NULL = cross-empresa
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('receber', 'pagar', 'ambos')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado da empresa pode ler (inclui cross-empresa com empresa_id NULL)
CREATE POLICY "cat_fin_select" ON categorias_financeiras
  FOR SELECT USING (empresa_id IS NULL OR mesma_empresa(empresa_id));

-- Apenas admin/gerente pode criar/editar/inativar
CREATE POLICY "cat_fin_insert" ON categorias_financeiras
  FOR INSERT WITH CHECK (is_administrador() OR is_gerente());

CREATE POLICY "cat_fin_update" ON categorias_financeiras
  FOR UPDATE USING (is_administrador() OR is_gerente());

CREATE POLICY "cat_fin_delete" ON categorias_financeiras
  FOR DELETE USING (is_administrador());

-- Seed básico cross-empresa
INSERT INTO categorias_financeiras (empresa_id, nome, tipo) VALUES
  (NULL, 'Estornos e Devoluções', 'ambos'),
  (NULL, 'Receitas Diversas', 'receber'),
  (NULL, 'Despesas Operacionais', 'pagar'),
  (NULL, 'Taxas e Encargos', 'pagar'),
  (NULL, 'Comissões e Incentivos', 'receber');
