-- =============================================================================
-- 060 — Valor adicional na primeira parcela do cartão agência
-- =============================================================================
-- Quando a Magic paga o fornecedor no cartão de crédito (`pgto_forma =
-- cartao_agencia`), é comum a primeira parcela vir com taxas extras (ex:
-- taxas de embarque em aéreo) que não se diluem nas demais.
--
-- Modelo de cálculo:
--   base = (pgto_valor_total - pgto_entrada - extra) / pgto_num_parcelas
--   parcela 1     = base + extra
--   parcelas 2..N = base
--
-- Soma = N*base + extra = (total - entrada - extra) + extra = total - entrada ✓
-- =============================================================================

ALTER TABLE venda_produtos
  ADD COLUMN IF NOT EXISTS pgto_primeira_parcela_extra numeric(12,2) NOT NULL DEFAULT 0
  CHECK (pgto_primeira_parcela_extra >= 0);

COMMENT ON COLUMN venda_produtos.pgto_primeira_parcela_extra IS
  'Valor adicional embutido na primeira parcela do cartão agência (ex.: taxas de embarque). 0 = parcelas iguais.';
