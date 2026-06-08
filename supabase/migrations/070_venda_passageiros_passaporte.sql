-- =============================================================================
-- 070 — Passageiro: campo passaporte
-- =============================================================================
-- Adiciona `passaporte` em venda_passageiros pra permitir registrar o nº
-- do passaporte de cada passageiro (vendas internacionais).
-- RPCs `criar_venda_completa` e `editar_venda_completa` atualizadas pra
-- gravar o campo no payload de passageiros.
-- =============================================================================
ALTER TABLE venda_passageiros
  ADD COLUMN IF NOT EXISTS passaporte text;

COMMENT ON COLUMN venda_passageiros.passaporte IS
  'Número do passaporte do passageiro. Opcional. Sempre uppercase.';
