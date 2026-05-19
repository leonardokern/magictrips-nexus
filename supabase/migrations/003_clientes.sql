-- =============================================================================
-- 003 — Clientes
-- =============================================================================
-- CPF e email são únicos POR EMPRESA (não globalmente).
-- tipo = 'regular' | 'faturado'. Faturado acumula viagens mensalmente.
-- =============================================================================

-- Habilitar pg_trgm antes dos índices que dependem dele
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE clientes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES empresas(id),
  nome              text NOT NULL,
  email             text NOT NULL,
  telefone          text NOT NULL,
  cpf               text NOT NULL,
  data_nascimento   date,
  endereco          jsonb,
  origem            text,
  tipo              text NOT NULL DEFAULT 'regular'
                    CHECK (tipo IN ('regular', 'faturado')),
  dia_faturamento   int CHECK (dia_faturamento BETWEEN 1 AND 31),
  status            text NOT NULL DEFAULT 'lead'
                    CHECK (status IN ('lead', 'ativo', 'inativo')),
  observacoes       text,
  crm_id            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_cliente_email_empresa UNIQUE (email, empresa_id),
  CONSTRAINT uq_cliente_cpf_empresa   UNIQUE (cpf, empresa_id),
  CONSTRAINT chk_dia_faturamento_se_faturado
    CHECK (tipo = 'regular' OR dia_faturamento IS NOT NULL)
);

COMMENT ON TABLE clientes IS 'Clientes pagadores. Mesmo CPF pode existir em empresas diferentes (Magic e Del Mondo).';
COMMENT ON COLUMN clientes.endereco IS 'JSONB: {rua, numero, complemento, cidade, estado, cep}';
COMMENT ON COLUMN clientes.dia_faturamento IS 'Dia do mês para fechamento. Obrigatório se tipo=faturado. Padrão da régua: 20';
COMMENT ON COLUMN clientes.crm_id IS 'ID no RD Station após sincronização (Fase 2)';

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_status ON clientes(status);
CREATE INDEX idx_clientes_tipo ON clientes(tipo);
CREATE INDEX idx_clientes_nome_trgm ON clientes USING gin (nome gin_trgm_ops);
CREATE INDEX idx_clientes_cpf ON clientes(cpf);

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
