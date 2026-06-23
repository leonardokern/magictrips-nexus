-- =============================================================================
-- 082 — venda_produtos.pgto_parcelas_detalhe
-- =============================================================================
-- Quando o pagamento ao fornecedor é "faturado", o agente agora informa N
-- parcelas com valor e data por parcela. Isso alimenta o controle de contas
-- a pagar (data prevista de cada faturamento).
--
-- Formato jsonb: array de objetos `{ ordem: int, valor: numeric, data: text }`
-- onde data é ISO YYYY-MM-DD. Vazio = sem parcelas detalhadas (uso anterior).
-- =============================================================================

ALTER TABLE venda_produtos
  ADD COLUMN IF NOT EXISTS pgto_parcelas_detalhe jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN venda_produtos.pgto_parcelas_detalhe IS
  'Distribuição de parcelas no pagamento ao fornecedor (faturado). Array de {ordem, valor, data}.';
