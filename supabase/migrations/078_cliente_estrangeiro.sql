-- =============================================================================
-- 078 — Campo estrangeiro em clientes
-- =============================================================================
-- Adiciona flag booleana `estrangeiro` à tabela clientes.
-- Quando true: CPF armazena documento estrangeiro (alfanumérico),
-- CEP é código postal livre e endereco.pais guarda o código ISO do país.
-- =============================================================================

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS estrangeiro boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clientes.estrangeiro IS
  'true = cliente estrangeiro. CPF guarda documento livre, endereço inclui pais (ISO 3166-1 alpha-2).';
