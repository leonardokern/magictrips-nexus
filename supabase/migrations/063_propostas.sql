-- =============================================================================
-- 063 — Propostas Comerciais
-- =============================================================================
-- Módulo de propostas: antecessor ao ciclo de vendas. Agente monta uma proposta
-- com produtos e valores, gera PDF executivo e envia ao cliente. Sem RAV,
-- comissão ou lógica financeira — só dados do cliente + produtos + valores.
-- =============================================================================

-- ── Tabela principal: propostas ───────────────────────────────────────────────
CREATE TABLE propostas (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador    text        NOT NULL,
  empresa_id       uuid        NOT NULL REFERENCES empresas(id),
  usuario_id       uuid        NOT NULL REFERENCES usuarios(id),
  -- Cliente: pode ser existente (cliente_id preenchido) ou prospect (campos inline)
  cliente_id       uuid        REFERENCES clientes(id),
  cliente_nome     text,
  cliente_email    text,
  cliente_telefone text,
  -- Dados da proposta
  data_proposta    date        NOT NULL DEFAULT CURRENT_DATE,
  validade         date,
  origem           text,
  destino          text,
  observacoes      text,
  -- Ciclo de vida
  status           text        NOT NULL DEFAULT 'rascunho'
                               CHECK (status IN ('rascunho','enviada','aceita','recusada','expirada')),
  -- Total calculado e armazenado (soma dos produtos)
  valor_total      numeric(12,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (identificador, empresa_id)
);

COMMENT ON TABLE propostas IS 'Propostas comerciais geradas para clientes/prospects. Antecessor ao ciclo de vendas.';
COMMENT ON COLUMN propostas.cliente_id IS 'Vínculo com cliente existente. Se NULL, usar campos cliente_nome/email/telefone (prospect).';
COMMENT ON COLUMN propostas.validade IS 'Data limite de validade da proposta. Exibida no PDF.';

-- ── Tabela de produtos da proposta ────────────────────────────────────────────
CREATE TABLE proposta_produtos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id       uuid        NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  ordem             smallint    NOT NULL DEFAULT 1,
  tipo_produto_id   uuid        REFERENCES tipos_produto(id),
  tipo_produto_nome text        NOT NULL DEFAULT '',
  fornecedor_id     uuid        REFERENCES fornecedores(id),
  fornecedor_nome   text,
  descricao         text,
  destino           text,
  data_inicio       date,
  data_fim          date,
  pax               smallint    NOT NULL DEFAULT 1,
  valor_venda       numeric(12,2) NOT NULL DEFAULT 0,
  observacoes       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE proposta_produtos IS 'Itens de cada proposta. Sem RAV/comissão — apenas dados comerciais para o cliente.';

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX propostas_empresa_id_idx        ON propostas(empresa_id);
CREATE INDEX propostas_usuario_id_idx        ON propostas(usuario_id);
CREATE INDEX propostas_cliente_id_idx        ON propostas(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX propostas_status_idx            ON propostas(status);
CREATE INDEX propostas_data_proposta_idx     ON propostas(data_proposta DESC);
CREATE INDEX proposta_produtos_proposta_idx  ON proposta_produtos(proposta_id);

-- ── Trigger: updated_at ───────────────────────────────────────────────────────
CREATE TRIGGER trg_propostas_updated_at
  BEFORE UPDATE ON propostas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Função: gerador de identificador ─────────────────────────────────────────
-- Formato: PRO-YYYY-NNN (ex: PRO-2026-001). Sequencial por empresa × ano.
CREATE OR REPLACE FUNCTION gerar_identificador_proposta(p_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano  int  := EXTRACT(year FROM CURRENT_DATE);
  v_seq  int;
BEGIN
  SELECT COALESCE(
    MAX(
      CAST(
        regexp_replace(identificador, '^PRO-\d{4}-0*(\d+)$', '\1')
        AS int
      )
    ), 0
  ) + 1
  INTO v_seq
  FROM propostas
  WHERE empresa_id = p_empresa_id
    AND identificador ~ ('^PRO-' || v_ano || '-\d+$');

  RETURN 'PRO-' || v_ano || '-' || LPAD(v_seq::text, 3, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION gerar_identificador_proposta(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION gerar_identificador_proposta(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION gerar_identificador_proposta IS 'Gera identificador sequencial PRO-YYYY-NNN para a empresa. Thread-safe via transação.';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE propostas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_produtos ENABLE ROW LEVEL SECURITY;

-- propostas: usuário da empresa lê e escreve; permissões granulares no app
CREATE POLICY propostas_select ON propostas
  FOR SELECT TO authenticated
  USING (mesma_empresa(empresa_id));

CREATE POLICY propostas_insert ON propostas
  FOR INSERT TO authenticated
  WITH CHECK (mesma_empresa(empresa_id));

CREATE POLICY propostas_update ON propostas
  FOR UPDATE TO authenticated
  USING (mesma_empresa(empresa_id))
  WITH CHECK (mesma_empresa(empresa_id));

CREATE POLICY propostas_delete ON propostas
  FOR DELETE TO authenticated
  USING (mesma_empresa(empresa_id));

-- proposta_produtos: acesso via proposta (mesma empresa)
CREATE POLICY proposta_produtos_all ON proposta_produtos
  FOR ALL TO authenticated
  USING (
    proposta_id IN (
      SELECT id FROM propostas WHERE mesma_empresa(empresa_id)
    )
  );

-- ── Permissões padrão nos perfis de acesso ────────────────────────────────────
-- Admin: tudo ligado. Gerente/Agente: tudo desligado (ativar via editor de perfis).
UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'),
  '{propostas}',
  '{"ler": true, "criar": true, "editar": true, "excluir": true}'
)
WHERE chave_sistema = 'admin';

UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'),
  '{propostas}',
  '{"ler": false, "criar": false, "editar": false, "excluir": false}'
)
WHERE chave_sistema IN ('gerente', 'agente');
