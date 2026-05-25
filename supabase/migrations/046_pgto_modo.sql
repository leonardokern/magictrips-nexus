-- =============================================================================
-- 046 — Modo de pagamento ao fornecedor (Comissionado vs NET)
-- =============================================================================
-- Comissionado (default): Valor a pagar = Valor de custo
-- NET (líquido):          Valor a pagar = Valor de custo − RAV extra fornecedor
-- Por enquanto afeta só o pgto_valor_total. Futuras integrações financeiras
-- poderão usar pgto_modo para outras regras (ex: contas a pagar, conciliação).
-- =============================================================================

ALTER TABLE venda_produtos
  ADD COLUMN IF NOT EXISTS pgto_modo TEXT NOT NULL DEFAULT 'comissionado';

ALTER TABLE venda_produtos
  DROP CONSTRAINT IF EXISTS venda_produtos_pgto_modo_check;

ALTER TABLE venda_produtos
  ADD CONSTRAINT venda_produtos_pgto_modo_check
  CHECK (pgto_modo IN ('comissionado', 'net'));
