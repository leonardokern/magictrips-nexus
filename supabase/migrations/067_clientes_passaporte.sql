-- =============================================================================
-- 067 — Cliente PF: campo passaporte (opcional)
-- =============================================================================
-- Adiciona `passaporte` em clientes (text nullable) e atualiza criar_venda_completa
-- pra persistir o campo quando um novo cliente PF é criado inline pelo wizard.
-- =============================================================================
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS passaporte text;

COMMENT ON COLUMN clientes.passaporte IS
  'Número do passaporte do cliente PF. Opcional. Usado em vendas internacionais.';

-- criar_venda_completa atualizada via apply_migration na mesma sessão.
-- O INSERT em clientes (PF inline) agora inclui passaporte.
