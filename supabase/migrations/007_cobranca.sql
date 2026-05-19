-- =============================================================================
-- 007 — Cobrança do Cliente (split payment)
-- =============================================================================
-- Uma venda tem 1 cobrança (cobranca_cliente). A cobrança pode ter N itens
-- com formas diferentes — split: parte faturado + parte cartão, etc.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- cobranca_cliente
-- ---------------------------------------------------------------------------
CREATE TABLE cobranca_cliente (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id     uuid NOT NULL UNIQUE REFERENCES vendas(id) ON DELETE CASCADE,
  valor_total  numeric(12,2) NOT NULL CHECK (valor_total >= 0),
  observacoes  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cobranca_cliente IS 'Cabeçalho da cobrança (1:1 com venda). valor_total = soma dos itens.';

-- ---------------------------------------------------------------------------
-- cobranca_cliente_itens
-- ---------------------------------------------------------------------------
CREATE TABLE cobranca_cliente_itens (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id                 uuid NOT NULL REFERENCES cobranca_cliente(id) ON DELETE CASCADE,
  tipo                        text NOT NULL CHECK (tipo IN (
    'direto_fornecedor', 'faturado_magic', 'link_pagamento', 'pix', 'boleto', 'outros'
  )),
  valor_total                 numeric(12,2) NOT NULL CHECK (valor_total >= 0),
  num_parcelas                int NOT NULL DEFAULT 1 CHECK (num_parcelas > 0),
  valor_parcela               numeric(12,2),
  -- Campos para 'link_pagamento'
  plataforma_link             text CHECK (plataforma_link IN ('PagSeguro', 'Cielo') OR plataforma_link IS NULL),
  valor_liquido               numeric(12,2),
  taxa_adquirente             numeric(12,2),
  data_primeiro_recebimento   date,
  -- Campos para 'faturado_magic'
  data_inicio                 date,
  -- Campos para 'direto_fornecedor'
  fornecedor_destino          text,
  observacoes                 text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cobranca_cliente_itens IS 'Itens de split de pagamento. Cada um tem tipo e seus campos específicos.';

CREATE INDEX idx_cobranca_itens_cobranca ON cobranca_cliente_itens(cobranca_id);
CREATE INDEX idx_cobranca_itens_tipo ON cobranca_cliente_itens(tipo);
