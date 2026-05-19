-- =============================================================================
-- 009 — Parcelas a Receber e a Pagar
-- =============================================================================
-- Geradas automaticamente quando uma venda é APROVADA (edge function
-- gerar-parcelas). Podem também ser criadas manualmente para despesas
-- operacionais (sem vínculo a venda).
--
-- Status: pendente → pago | atrasado | cancelado
-- =============================================================================

-- ---------------------------------------------------------------------------
-- parcelas_receber
-- ---------------------------------------------------------------------------
CREATE TABLE parcelas_receber (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES empresas(id),
  venda_id           uuid REFERENCES vendas(id),
  cobranca_item_id   uuid REFERENCES cobranca_cliente_itens(id),
  cliente_id         uuid REFERENCES clientes(id),
  numero             int NOT NULL CHECK (numero > 0),
  total_parcelas     int NOT NULL CHECK (total_parcelas > 0),
  descricao          text,
  valor              numeric(12,2) NOT NULL CHECK (valor >= 0),
  forma_pagamento    text,
  data_emissao       date NOT NULL,
  data_vencimento    date NOT NULL,
  data_pagamento     date,
  status             text NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  observacoes        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_pago_tem_data CHECK (
    (status = 'pago' AND data_pagamento IS NOT NULL)
    OR (status <> 'pago')
  ),
  CONSTRAINT chk_numero_dentro_total CHECK (numero <= total_parcelas)
);

COMMENT ON TABLE parcelas_receber IS 'Parcelas a receber do cliente. Geradas ao aprovar venda. Podem ser manuais.';

CREATE INDEX idx_parcelas_receber_empresa ON parcelas_receber(empresa_id);
CREATE INDEX idx_parcelas_receber_venda ON parcelas_receber(venda_id);
CREATE INDEX idx_parcelas_receber_cliente ON parcelas_receber(cliente_id);
CREATE INDEX idx_parcelas_receber_status ON parcelas_receber(status);
CREATE INDEX idx_parcelas_receber_vencimento ON parcelas_receber(data_vencimento);
CREATE INDEX idx_parcelas_receber_pendentes
  ON parcelas_receber(data_vencimento)
  WHERE status IN ('pendente', 'atrasado');

CREATE TRIGGER trg_parcelas_receber_updated_at
  BEFORE UPDATE ON parcelas_receber
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- parcelas_pagar
-- ---------------------------------------------------------------------------
CREATE TABLE parcelas_pagar (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES empresas(id),
  venda_produto_id uuid REFERENCES venda_produtos(id),
  fornecedor_id    uuid REFERENCES fornecedores(id),
  fornecedor_nome  text NOT NULL,
  numero           int NOT NULL CHECK (numero > 0),
  total_parcelas   int NOT NULL CHECK (total_parcelas > 0),
  descricao        text,
  valor            numeric(12,2) NOT NULL CHECK (valor >= 0),
  forma_pagamento  text,
  cartao_id        uuid REFERENCES cartoes(id),
  data_emissao     date NOT NULL,
  data_vencimento  date NOT NULL,
  data_pagamento   date,
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  observacoes      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_pago_tem_data_pagar CHECK (
    (status = 'pago' AND data_pagamento IS NOT NULL)
    OR (status <> 'pago')
  ),
  CONSTRAINT chk_numero_dentro_total_pagar CHECK (numero <= total_parcelas)
);

COMMENT ON TABLE parcelas_pagar IS 'Parcelas a pagar ao fornecedor. Geradas ao aprovar venda. Podem ser manuais (despesas).';

CREATE INDEX idx_parcelas_pagar_empresa ON parcelas_pagar(empresa_id);
CREATE INDEX idx_parcelas_pagar_produto ON parcelas_pagar(venda_produto_id);
CREATE INDEX idx_parcelas_pagar_fornecedor ON parcelas_pagar(fornecedor_id);
CREATE INDEX idx_parcelas_pagar_cartao ON parcelas_pagar(cartao_id) WHERE cartao_id IS NOT NULL;
CREATE INDEX idx_parcelas_pagar_status ON parcelas_pagar(status);
CREATE INDEX idx_parcelas_pagar_vencimento ON parcelas_pagar(data_vencimento);
CREATE INDEX idx_parcelas_pagar_pendentes
  ON parcelas_pagar(data_vencimento)
  WHERE status IN ('pendente', 'atrasado');

CREATE TRIGGER trg_parcelas_pagar_updated_at
  BEFORE UPDATE ON parcelas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
