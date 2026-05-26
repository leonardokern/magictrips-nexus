-- =============================================================================
-- 048 — Modos de pagamento do fornecedor
-- =============================================================================
-- Define quais modos de pagamento o fornecedor aceita com a empresa.
--
-- modo_comissionado: fornecedor paga o valor cheio e repassa o RAV extra
--   depois, na data definida (modo_comissionado_dia_pagamento).
--   Gera lançamento futuro em contas a receber.
--
-- modo_net: fornecedor desconta o RAV extra na hora; empresa recebe
--   somente o custo líquido. Não gera contas a receber separado.
-- =============================================================================

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS modo_comissionado             boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modo_comissionado_dia_pagamento smallint
    CHECK (modo_comissionado_dia_pagamento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS modo_net                      boolean  NOT NULL DEFAULT false;

COMMENT ON COLUMN fornecedores.modo_comissionado IS
  'Fornecedor aceita pagamento comissionado (repassa RAV extra na data definida).';
COMMENT ON COLUMN fornecedores.modo_comissionado_dia_pagamento IS
  'Dia do mês em que o fornecedor repassa o RAV extra comissionado (1–31).';
COMMENT ON COLUMN fornecedores.modo_net IS
  'Fornecedor aceita pagamento NET (desconta RAV extra na hora do pagamento).';
