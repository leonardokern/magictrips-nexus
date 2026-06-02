-- =============================================================================
-- 062 — Cobrança: campo `plataforma` (Select PagSeguro/Cielo) e
--       `parcelas_detalhe` (array JSONB com valor + data por parcela)
-- =============================================================================
-- Mudanças no Step 3 da venda:
-- 1. Plataforma deixa de ser texto livre e vira Select restrito a
--    PagSeguro / Cielo (CHECK no banco). `plataforma_link` continua text
--    livre — é o URL do pagamento (usado por link_externo).
-- 2. Parcelas planejadas: quando num_parcelas > 1, o operador pode
--    definir valor e data de cada parcela. Persistido como JSONB
--    [{ordem, valor, data}, ...]. Default '[]' quando à vista.
-- =============================================================================
ALTER TABLE cobranca_cliente_itens
  ADD COLUMN IF NOT EXISTS plataforma text
    CHECK (plataforma IN ('PagSeguro', 'Cielo') OR plataforma IS NULL);

ALTER TABLE cobranca_cliente_itens
  ADD COLUMN IF NOT EXISTS parcelas_detalhe jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN cobranca_cliente_itens.plataforma IS
  'Plataforma de pagamento usada (PagSeguro ou Cielo). Aplica-se a qualquer tipo de cobrança.';
COMMENT ON COLUMN cobranca_cliente_itens.parcelas_detalhe IS
  'Distribuição planejada das parcelas como array JSONB de { ordem, valor, data }.';

-- Funções criar_venda_completa e editar_venda_completa atualizadas via
-- apply_migration (mesma sessão). Mantém o INSERT em cobranca_cliente_itens
-- incluindo `plataforma` e `parcelas_detalhe`.
