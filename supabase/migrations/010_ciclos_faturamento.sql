-- =============================================================================
-- 010 — Ciclos de Faturamento (clientes faturados)
-- =============================================================================
-- Acúmulo mensal de vendas de clientes faturados. Fecha dia 20 do mês corrente.
-- Cliente paga dia 20 do mês seguinte.
-- Status: aberto → faturado → pago
-- =============================================================================

CREATE TABLE ciclos_faturamento (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid NOT NULL REFERENCES clientes(id),
  empresa_id          uuid NOT NULL REFERENCES empresas(id),
  mes                 int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano                 int NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  data_fechamento     date,
  data_vencimento     date,
  data_envio_fatura   date,
  valor_total         numeric(12,2) DEFAULT 0,
  status              text NOT NULL DEFAULT 'aberto'
                      CHECK (status IN ('aberto', 'faturado', 'pago', 'cancelado')),
  fatura_pdf_path     text,
  observacoes         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_ciclo_cliente_mes_ano UNIQUE (cliente_id, mes, ano)
);

COMMENT ON TABLE ciclos_faturamento IS 'Ciclos mensais de faturamento de clientes faturados.';
COMMENT ON COLUMN ciclos_faturamento.fatura_pdf_path IS 'Caminho no Supabase Storage do PDF da fatura gerada';

CREATE INDEX idx_ciclos_cliente ON ciclos_faturamento(cliente_id);
CREATE INDEX idx_ciclos_empresa ON ciclos_faturamento(empresa_id);
CREATE INDEX idx_ciclos_status ON ciclos_faturamento(status);
CREATE INDEX idx_ciclos_mes_ano ON ciclos_faturamento(ano, mes);

CREATE TRIGGER trg_ciclos_updated_at
  BEFORE UPDATE ON ciclos_faturamento
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Vincula venda ao ciclo via coluna em vendas (necessário para queries de ciclo)
-- Adicionada agora para evitar reciclo de migrations.
ALTER TABLE vendas
  ADD COLUMN ciclo_faturamento_id uuid REFERENCES ciclos_faturamento(id);

CREATE INDEX idx_vendas_ciclo ON vendas(ciclo_faturamento_id)
  WHERE ciclo_faturamento_id IS NOT NULL;

COMMENT ON COLUMN vendas.ciclo_faturamento_id IS 'Ciclo de faturamento da venda (somente para clientes faturados, populado ao aprovar)';
