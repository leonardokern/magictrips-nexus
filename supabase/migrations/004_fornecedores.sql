-- =============================================================================
-- 004 — Fornecedores
-- =============================================================================
-- Entidades pré-cadastradas. Agentes selecionam em dropdown — nunca texto livre.
-- CNPJ é obrigatório e único para prevenir duplicatas.
-- =============================================================================

CREATE TABLE fornecedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  cnpj        text NOT NULL UNIQUE,
  tipo        text CHECK (tipo IN ('consolidador', 'cia_aerea', 'hotel', 'operadora', 'outros')),
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fornecedores IS 'Fornecedores pré-cadastrados (OTT, GOL, hotéis, operadoras). CNPJ único.';

CREATE INDEX idx_fornecedores_ativo ON fornecedores(ativo) WHERE ativo = true;
CREATE INDEX idx_fornecedores_tipo ON fornecedores(tipo);
CREATE INDEX idx_fornecedores_nome_trgm ON fornecedores USING gin (nome gin_trgm_ops);
