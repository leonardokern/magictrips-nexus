-- =============================================================================
-- 065 — Cotações de Fornecedores para Propostas
-- =============================================================================
-- Registra uploads de PDFs/HTMLs de fornecedores e o resultado da extração
-- via Claude. Desacoplado da proposta: a cotação pode existir antes da proposta
-- ser criada (o agente analisa e então preenche o wizard).
-- =============================================================================

CREATE TABLE proposta_cotacoes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid        NOT NULL REFERENCES empresas(id),
  usuario_id       uuid        NOT NULL REFERENCES usuarios(id),

  -- Origem da cotação
  tipo_entrada     text        NOT NULL DEFAULT 'pdf'
                               CHECK (tipo_entrada IN ('pdf', 'url')),
  nome_arquivo     text        NOT NULL,   -- nome original do PDF ou a URL
  mime_type        text        NOT NULL,   -- "application/pdf" ou "text/html"
  tamanho_bytes    bigint,
  storage_path     text,                  -- path no bucket "proposta-cotacoes" (nulo quando URL)
  url_origem       text,                  -- URL original (nulo quando PDF)

  -- Processamento IA
  status           text        NOT NULL DEFAULT 'pendente'
                               CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  dados_extraidos  jsonb,                 -- CotacaoExtraida quando status = 'concluido'
  erro_mensagem    text,                  -- mensagem quando status = 'erro'

  -- Vínculo opcional com proposta (preenchido após o agente confirmar)
  proposta_id      uuid        REFERENCES propostas(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE proposta_cotacoes IS
  'PDFs e URLs de cotações de fornecedores (Skyplus, Incomum, OTT…). '
  'Processados pelo Claude para auto-preencher o wizard de propostas.';

-- Índices
CREATE INDEX proposta_cotacoes_empresa_idx    ON proposta_cotacoes(empresa_id);
CREATE INDEX proposta_cotacoes_usuario_idx    ON proposta_cotacoes(usuario_id);
CREATE INDEX proposta_cotacoes_proposta_idx   ON proposta_cotacoes(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE INDEX proposta_cotacoes_status_idx     ON proposta_cotacoes(status);
CREATE INDEX proposta_cotacoes_created_idx    ON proposta_cotacoes(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_proposta_cotacoes_updated_at
  BEFORE UPDATE ON proposta_cotacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE proposta_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposta_cotacoes_empresa ON proposta_cotacoes
  FOR ALL TO authenticated
  USING (mesma_empresa(empresa_id))
  WITH CHECK (mesma_empresa(empresa_id));
