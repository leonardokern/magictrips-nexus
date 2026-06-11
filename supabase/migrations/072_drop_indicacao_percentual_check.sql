-- =============================================================================
-- 072 — Remove constraint legada de indicacao_percentual (30/40/50% fixos)
-- =============================================================================
-- A constraint vendas_indicacao_percentual_check restringia o campo a
-- 30/40/50% fixos — modelo legado de comissão. A partir das migrações
-- 018+ (comissoes_regras), 028+ (perfis_comissoes) e do override por
-- usuarios.comissao_percentual, qualquer percentual válido (0..100) é
-- aceitável. Exemplos reais:
--   - Jéssica/Del Mondo = 12%
--   - Regras por origem de lead podem ter percentuais customizados
--
-- A constraint estava bloqueando cadastro de vendas com percentuais
-- legítimos vindos da régua dinâmica (ex: 12%, 25%, etc).
-- =============================================================================
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_indicacao_percentual_check;

-- Substitui por range sanity-check (0..100) — bloqueia valores absurdos
-- mas aceita qualquer percentual válido.
ALTER TABLE vendas ADD CONSTRAINT vendas_indicacao_percentual_check
  CHECK (
    indicacao_percentual IS NULL
    OR (indicacao_percentual >= 0 AND indicacao_percentual <= 100)
  );

COMMENT ON COLUMN vendas.indicacao_percentual IS
  'Snapshot do percentual de comissão do agente no momento da venda. Range 0..100. Antes era restrito a 30/40/50% (legado); hoje vem da régua dinâmica (origens_venda, perfis_comissoes, usuarios.comissao_percentual).';
