-- =============================================================================
-- 068 — Cobrança: comprovante de pagamento obrigatório por item
-- =============================================================================
-- Cada item da cobrança_cliente_itens recebe 4 colunas pra rastrear o
-- arquivo de comprovante armazenado no bucket `venda-anexos`:
--   comprovante_storage_path     — path completo no bucket
--   comprovante_nome_arquivo     — nome original (UX)
--   comprovante_mime_type        — image/* ou application/pdf
--   comprovante_tamanho_bytes    — tamanho em bytes
--
-- A obrigatoriedade é forçada em zod/UI no client — banco aceita NULL
-- (pra não quebrar dados antigos pré-migração).
-- =============================================================================
ALTER TABLE cobranca_cliente_itens
  ADD COLUMN IF NOT EXISTS comprovante_storage_path text,
  ADD COLUMN IF NOT EXISTS comprovante_nome_arquivo text,
  ADD COLUMN IF NOT EXISTS comprovante_mime_type    text,
  ADD COLUMN IF NOT EXISTS comprovante_tamanho_bytes int;

COMMENT ON COLUMN cobranca_cliente_itens.comprovante_storage_path IS
  'Path do comprovante no bucket venda-anexos. Formato: comprovantes/<uuid>.<ext>.';
COMMENT ON COLUMN cobranca_cliente_itens.comprovante_nome_arquivo IS
  'Nome original do arquivo de comprovante.';

-- criar_venda_completa + editar_venda_completa atualizadas via apply_migration:
-- ambos os INSERTs em cobranca_cliente_itens passam os 4 novos campos.
