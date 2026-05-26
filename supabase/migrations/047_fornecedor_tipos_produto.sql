-- =============================================================================
-- 047 — Fornecedor × Tipos de Produto
-- =============================================================================
-- Junction table que vincula fornecedores aos tipos de produto que eles atendem.
-- Usado no wizard de venda para filtrar fornecedores por tipo de produto selecionado.
-- =============================================================================

CREATE TABLE fornecedor_tipos_produto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id    uuid NOT NULL REFERENCES fornecedores(id)    ON DELETE CASCADE,
  tipo_produto_id  uuid NOT NULL REFERENCES tipos_produto(id)   ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id, tipo_produto_id)
);

CREATE INDEX idx_ftp_fornecedor   ON fornecedor_tipos_produto(fornecedor_id);
CREATE INDEX idx_ftp_tipo_produto ON fornecedor_tipos_produto(tipo_produto_id);

COMMENT ON TABLE fornecedor_tipos_produto IS
  'N:N entre fornecedores e tipos_produto. '
  'Define quais tipos de produto cada fornecedor atende. '
  'Usado para filtrar o seletor de fornecedor no wizard de venda.';
