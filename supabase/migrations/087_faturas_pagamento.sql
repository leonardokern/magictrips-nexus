-- Colunas de pagamento na fatura
ALTER TABLE faturas
  ADD COLUMN IF NOT EXISTS caixa_id      UUID REFERENCES caixas(id),
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS valor_recebido NUMERIC(12,2);

-- Adiciona status 'paga' à fatura
ALTER TABLE faturas DROP CONSTRAINT IF EXISTS faturas_status_check;
ALTER TABLE faturas ADD CONSTRAINT faturas_status_check
  CHECK (status IN ('gerada','enviada','paga','cancelada'));

-- Adiciona caixa_id e status pago_atraso em parcelas_receber
ALTER TABLE parcelas_receber ADD COLUMN IF NOT EXISTS caixa_id UUID REFERENCES caixas(id);
ALTER TABLE parcelas_receber DROP CONSTRAINT IF EXISTS parcelas_receber_status_check;
ALTER TABLE parcelas_receber ADD CONSTRAINT parcelas_receber_status_check
  CHECK (status IN ('pendente','pago','pago_atraso','atrasado','cancelado'));

-- Mesma coisa para parcelas_pagar (consistência)
ALTER TABLE parcelas_pagar DROP CONSTRAINT IF EXISTS parcelas_pagar_status_check;
ALTER TABLE parcelas_pagar ADD CONSTRAINT parcelas_pagar_status_check
  CHECK (status IN ('pendente','pago','pago_atraso','atrasado','cancelado'));
