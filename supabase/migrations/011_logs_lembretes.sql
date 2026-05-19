-- =============================================================================
-- 011 — Lembretes + Audit Logs + Integration Logs
-- =============================================================================
-- lembretes        — gerados por cron diário ou em fluxos específicos
-- audit_logs       — imutável (RLS bloqueia UPDATE/DELETE — definido em 012)
-- integration_logs — log de chamadas para integrações externas (RD Station etc)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- lembretes
-- ---------------------------------------------------------------------------
CREATE TABLE lembretes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid REFERENCES empresas(id),
  destinatario_id  uuid REFERENCES usuarios(id),
  tipo             text NOT NULL CHECK (tipo IN (
    'faturamento_fechamento',
    'faturamento_vencimento',
    'cartao_vencimento',
    'parcela_atrasada',
    'venda_pendente_validacao'
  )),
  referencia_tipo  text,
  referencia_id    uuid,
  data_lembrete    date NOT NULL,
  mensagem         text NOT NULL,
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'enviado', 'dispensado')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE lembretes IS 'Avisos exibidos no dashboard. Gerados pela edge function processar-lembretes (cron diário) ou em fluxos pontuais.';
COMMENT ON COLUMN lembretes.destinatario_id IS 'NULL = lembrete da empresa (todos veem). Preenchido = pessoal';

CREATE INDEX idx_lembretes_destinatario ON lembretes(destinatario_id);
CREATE INDEX idx_lembretes_empresa ON lembretes(empresa_id);
CREATE INDEX idx_lembretes_status ON lembretes(status);
CREATE INDEX idx_lembretes_pendentes ON lembretes(data_lembrete) WHERE status = 'pendente';

-- ---------------------------------------------------------------------------
-- audit_logs (imutável)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid REFERENCES usuarios(id),
  empresa_id    uuid REFERENCES empresas(id),
  acao          text NOT NULL,
  entidade      text NOT NULL,
  entidade_id   uuid,
  dados_antes   jsonb,
  dados_depois  jsonb,
  motivo        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Log imutável de ações críticas. RLS bloqueia UPDATE/DELETE (ver 012_rls.sql).';
COMMENT ON COLUMN audit_logs.acao IS 'Ex: criar, editar, aprovar, devolver, cancelar, pagar, resetar_senha';
COMMENT ON COLUMN audit_logs.entidade IS 'Ex: cliente, venda, parcela_receber, usuario';

CREATE INDEX idx_audit_logs_usuario ON audit_logs(usuario_id);
CREATE INDEX idx_audit_logs_empresa ON audit_logs(empresa_id);
CREATE INDEX idx_audit_logs_entidade ON audit_logs(entidade, entidade_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- integration_logs
-- ---------------------------------------------------------------------------
CREATE TABLE integration_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao   text NOT NULL,
  operacao     text NOT NULL,
  empresa_id   uuid REFERENCES empresas(id),
  entidade     text,
  entidade_id  uuid,
  payload      jsonb,
  resposta     jsonb,
  status       text NOT NULL CHECK (status IN ('sucesso', 'erro', 'retry')),
  erro         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE integration_logs IS 'Log de chamadas para integrações externas (RD Station, Resend, etc).';

CREATE INDEX idx_integration_logs_integracao ON integration_logs(integracao);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_created ON integration_logs(created_at DESC);
