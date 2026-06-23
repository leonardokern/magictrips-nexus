-- ============================================================
-- Tabela faturas — entidade persistida de fatura gerada
-- ============================================================

CREATE TABLE faturas (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID        NOT NULL REFERENCES empresas(id),
  numero            TEXT        NOT NULL,           -- "INV-2026-010001"
  numero_display    TEXT        NOT NULL,           -- "#INV-2026-010001"
  numero_sequencial INT         NOT NULL,           -- 1, 2, 3 … (para cálculo interno)
  ano               INT         NOT NULL,
  cliente_id        UUID        NOT NULL REFERENCES clientes(id),
  data_emissao      DATE        NOT NULL DEFAULT CURRENT_DATE,
  valor_total       NUMERIC(12,2) NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'gerada'
                    CHECK (status IN ('gerada', 'enviada', 'cancelada')),
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, numero_sequencial, ano)
);

-- Junction: quais parcelas_receber fazem parte desta fatura.
-- UNIQUE em parcela_id impede que a mesma parcela entre em 2 faturas.
CREATE TABLE fatura_parcelas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id   UUID NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  parcela_id  UUID NOT NULL REFERENCES parcelas_receber(id),
  UNIQUE (parcela_id)
);

-- Índices de desempenho
CREATE INDEX ON faturas (empresa_id);
CREATE INDEX ON faturas (cliente_id);
CREATE INDEX ON faturas (status);
CREATE INDEX ON faturas (ano, empresa_id);
CREATE INDEX ON fatura_parcelas (fatura_id);

-- Trigger updated_at
CREATE TRIGGER trg_faturas_updated_at
  BEFORE UPDATE ON faturas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_parcelas ENABLE ROW LEVEL SECURITY;

-- Faturas visíveis apenas para usuários da mesma empresa
CREATE POLICY "faturas_empresa_isolation"
  ON faturas
  USING (
    empresa_id IN (
      SELECT ue.empresa_id
      FROM usuario_empresas ue
      WHERE ue.usuario_id = auth.uid()
    )
  );

-- Fatura_parcelas acessível se o usuário enxerga a fatura pai
CREATE POLICY "fatura_parcelas_via_fatura"
  ON fatura_parcelas
  USING (
    fatura_id IN (
      SELECT f.id FROM faturas f
      JOIN usuario_empresas ue ON ue.empresa_id = f.empresa_id
      WHERE ue.usuario_id = auth.uid()
    )
  );

-- ── Função sequencial ─────────────────────────────────────────────────────────
-- Retorna o próximo número sequencial de fatura para uma empresa/ano.
-- Chamada dentro de uma transação garante que não há race condition.

CREATE OR REPLACE FUNCTION proximo_numero_fatura(p_empresa_id UUID, p_ano INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(numero_sequencial), 0) + 1
    INTO v_seq
    FROM faturas
   WHERE empresa_id = p_empresa_id
     AND ano = p_ano;
  RETURN v_seq;
END;
$$;
