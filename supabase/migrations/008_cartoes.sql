-- =============================================================================
-- 008 — Cartões da Agência
-- =============================================================================
-- Cartões de crédito próprios usados para pagar fornecedores (especialmente
-- em clientes faturados). Cada cartão tem dia de vencimento e fechamento.
-- =============================================================================

CREATE TABLE cartoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES empresas(id),
  usuario_id       uuid NOT NULL REFERENCES usuarios(id),
  nome             text NOT NULL,
  banco            text,
  dia_vencimento   int NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_fechamento   int CHECK (dia_fechamento BETWEEN 1 AND 31),
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cartoes IS 'Cartões da agência. usuario_id = titular/responsável.';

CREATE INDEX idx_cartoes_empresa ON cartoes(empresa_id);
CREATE INDEX idx_cartoes_usuario ON cartoes(usuario_id);
CREATE INDEX idx_cartoes_ativo ON cartoes(ativo) WHERE ativo = true;

-- Adiciona FK pendente em venda_produtos.pgto_cartao_id (declarado em 006)
ALTER TABLE venda_produtos
  ADD CONSTRAINT fk_venda_produtos_cartao
  FOREIGN KEY (pgto_cartao_id) REFERENCES cartoes(id);

CREATE INDEX idx_venda_produtos_cartao ON venda_produtos(pgto_cartao_id)
  WHERE pgto_cartao_id IS NOT NULL;
