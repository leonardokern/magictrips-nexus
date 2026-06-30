-- Lançamentos manuais: adiciona categoria_id + is_manual às parcelas, caixa_id em pagar,
-- e cria tabela de anexos para comprovantes

-- parcelas_receber: categoria financeira + flag manual
ALTER TABLE parcelas_receber
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_financeiras(id),
  ADD COLUMN IF NOT EXISTS is_manual    BOOLEAN NOT NULL DEFAULT false;

-- parcelas_pagar: categoria + caixa_id (quando o pagamento sai de conta bancária, não cartão) + flag manual
ALTER TABLE parcelas_pagar
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_financeiras(id),
  ADD COLUMN IF NOT EXISTS caixa_id     UUID REFERENCES caixas(id),
  ADD COLUMN IF NOT EXISTS is_manual    BOOLEAN NOT NULL DEFAULT false;

-- Índices para filtrar lançamentos manuais
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_manual ON parcelas_receber (empresa_id) WHERE is_manual = true;
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_manual   ON parcelas_pagar   (empresa_id) WHERE is_manual = true;

-- Tabela de anexos para lançamentos manuais (comprovantes)
CREATE TABLE IF NOT EXISTS lancamento_anexos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id),
  parcela_receber_id UUID REFERENCES parcelas_receber(id) ON DELETE CASCADE,
  parcela_pagar_id   UUID REFERENCES parcelas_pagar(id)   ON DELETE CASCADE,
  nome_arquivo       TEXT NOT NULL,
  storage_path       TEXT NOT NULL,
  mime_type          TEXT,
  tamanho_bytes      BIGINT,
  created_by         UUID NOT NULL REFERENCES usuarios(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exatamente um dos dois IDs deve ser preenchido
  CONSTRAINT chk_exatamente_um CHECK (
    (parcela_receber_id IS NOT NULL)::int + (parcela_pagar_id IS NOT NULL)::int = 1
  )
);

ALTER TABLE lancamento_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamento_anexos_select" ON lancamento_anexos
  FOR SELECT USING (mesma_empresa(empresa_id));

CREATE POLICY "lancamento_anexos_insert" ON lancamento_anexos
  FOR INSERT WITH CHECK (mesma_empresa(empresa_id) AND created_by = auth.uid());

CREATE POLICY "lancamento_anexos_delete" ON lancamento_anexos
  FOR DELETE USING (mesma_empresa(empresa_id) AND (created_by = auth.uid() OR is_administrador() OR is_gerente()));

CREATE INDEX IF NOT EXISTS idx_lancamento_anexos_empresa  ON lancamento_anexos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_lancamento_anexos_receber  ON lancamento_anexos (parcela_receber_id) WHERE parcela_receber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lancamento_anexos_pagar    ON lancamento_anexos (parcela_pagar_id)   WHERE parcela_pagar_id   IS NOT NULL;
