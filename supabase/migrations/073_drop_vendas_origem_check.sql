-- =============================================================================
-- 073 — Remove constraint legada de vendas.origem (lista hardcoded)
-- =============================================================================
-- A constraint vendas_origem_check fixava uma lista de origens hardcoded
-- em SQL — modelo legado. Hoje a régua de origens é dinâmica via
-- `origens_venda` (CRUD em /origens). Itens já cadastrados que NÃO
-- estavam no CHECK e bloqueavam novas vendas:
--   - "Chat"                          (CHECK tinha "Chat Online")
--   - "Indicação dos Sócios/Agência"  (CHECK tinha "Indicação dos Sócios")
--
-- Integridade do campo continua garantida pelo Select de origens no
-- wizard que vem da tabela origens_venda — não há razão pra duplicar a
-- lista no CHECK do Postgres. Mesmo padrão da migration 072 que removeu
-- o CHECK legado de indicacao_percentual (30/40/50% fixos).
-- =============================================================================
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_origem_check;

COMMENT ON COLUMN vendas.origem IS
  'Snapshot do nome da origem do lead no momento da venda. Validação via tabela origens_venda (régua dinâmica). Antes era restrito por CHECK constraint com lista hardcoded (legado).';
