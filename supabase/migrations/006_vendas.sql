-- =============================================================================
-- 006 — Vendas + Passageiros + Produtos
-- =============================================================================
-- Cabeçalho (vendas) + N produtos (venda_produtos) + N passageiros
-- (venda_passageiros) + junction de quais passageiros viajam em cada produto
-- (venda_produto_passageiros).
--
-- Ciclo de vida: rascunho → pendente_validacao → aprovado → cancelado
-- Parcelas são geradas SOMENTE ao aprovar (não ao salvar).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- vendas (cabeçalho)
-- ---------------------------------------------------------------------------
CREATE TABLE vendas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES empresas(id),
  cliente_id            uuid NOT NULL REFERENCES clientes(id),
  usuario_id            uuid NOT NULL REFERENCES usuarios(id),
  data_venda            date NOT NULL,
  origem                text CHECK (origem IN (
    'Cliente Antigo', 'Tráfego Pago', 'Remarketing', 'Landing Page',
    'Chat Online', 'Redes Sociais', 'Indicação de Cliente',
    'Indicação dos Sócios', 'Lead Próprio do Agente', 'Parceiros', 'Outros'
  )),
  flag_marketing        boolean NOT NULL DEFAULT false,
  indicacao_percentual  numeric(5,2) CHECK (indicacao_percentual IN (30.00, 40.00, 50.00)),
  pax                   int NOT NULL DEFAULT 1 CHECK (pax > 0),
  status                text NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho', 'pendente_validacao', 'aprovado', 'cancelado')),
  motivo_devolucao      text,
  data_aprovacao        timestamptz,
  aprovado_por          uuid REFERENCES usuarios(id),
  data_cancelamento     timestamptz,
  cancelado_por         uuid REFERENCES usuarios(id),
  observacoes           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendas IS 'Cabeçalho da venda. Parcelas geradas apenas ao status aprovado.';
COMMENT ON COLUMN vendas.data_venda IS 'Data de emissão dos produtos/bilhetes';
COMMENT ON COLUMN vendas.flag_marketing IS 'True se origem é online (exceto Cliente Antigo) — para divisão de comissão de marketing';
COMMENT ON COLUMN vendas.indicacao_percentual IS '30/40/50 (régua Magic Trips). NULL = Del Mondo usa comissao_percentual do usuário';

CREATE INDEX idx_vendas_empresa ON vendas(empresa_id);
CREATE INDEX idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX idx_vendas_usuario ON vendas(usuario_id);
CREATE INDEX idx_vendas_status ON vendas(status);
CREATE INDEX idx_vendas_data ON vendas(data_venda);
CREATE INDEX idx_vendas_pendentes_validacao ON vendas(status) WHERE status = 'pendente_validacao';

CREATE TRIGGER trg_vendas_updated_at
  BEFORE UPDATE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Auto-marca flag_marketing baseado na origem
CREATE OR REPLACE FUNCTION set_flag_marketing()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.flag_marketing := NEW.origem IN (
    'Tráfego Pago', 'Remarketing', 'Landing Page', 'Chat Online', 'Redes Sociais'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendas_flag_marketing
  BEFORE INSERT OR UPDATE OF origem ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION set_flag_marketing();

-- ---------------------------------------------------------------------------
-- venda_passageiros
-- ---------------------------------------------------------------------------
CREATE TABLE venda_passageiros (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id         uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  cpf              text,
  data_nascimento  date,
  ordem            int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE venda_passageiros IS 'Viajantes da venda. Diferentes do cliente_id do cabeçalho (que é o pagador).';

CREATE INDEX idx_venda_passageiros_venda ON venda_passageiros(venda_id);

-- ---------------------------------------------------------------------------
-- venda_produtos
-- ---------------------------------------------------------------------------
-- Nota: fornecedor_id é nullable e fornecedor_nome é NOT NULL.
-- Isso preserva snapshot do nome mesmo se o fornecedor for desativado/editado.
-- Para "Outros" (fornecedor inline criado pelo agente), o nome é preservado
-- mesmo após o registro de fornecedor ser eventualmente removido.

CREATE TABLE venda_produtos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id                 uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  ordem                    int NOT NULL DEFAULT 1,
  tipo_produto_id          uuid NOT NULL REFERENCES tipos_produto(id),
  tipo_produto_nome        text NOT NULL,
  fornecedor_id            uuid REFERENCES fornecedores(id),
  fornecedor_nome          text NOT NULL,
  localizador              text,
  localizador_fornecedor   text,
  destino                  text,
  data_inicio_viagem       date,
  data_fim_viagem          date,
  valores_extras           jsonb NOT NULL DEFAULT '{}'::jsonb,
  tipo_comissao            text CHECK (tipo_comissao IN ('Com', 'Net')),
  valor_venda              numeric(12,2) NOT NULL CHECK (valor_venda >= 0),
  valor_custo              numeric(12,2) NOT NULL CHECK (valor_custo >= 0),
  rav                      numeric(12,2),
  rav_extra_cliente        numeric(12,2) NOT NULL DEFAULT 0,
  rav_extra_fornecedor     numeric(12,2) NOT NULL DEFAULT 0,
  comissao_vendedor        numeric(12,2),
  -- Pagamento da agência ao fornecedor
  pgto_status              text NOT NULL DEFAULT 'pendente'
                           CHECK (pgto_status IN ('pendente', 'pago', 'nao_se_aplica')),
  pgto_cartao_id           uuid,  -- FK adicionada após criação da tabela cartoes (008)
  pgto_forma               text,
  pgto_valor_total         numeric(12,2),
  pgto_entrada             numeric(12,2) DEFAULT 0,
  pgto_num_parcelas        int DEFAULT 1 CHECK (pgto_num_parcelas > 0),
  pgto_valor_parcela       numeric(12,2),
  pgto_data_debito         date,
  created_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE venda_produtos IS 'Produtos de uma venda. fornecedor_nome e tipo_produto_nome são snapshots históricos.';
COMMENT ON COLUMN venda_produtos.valores_extras IS 'Snapshot dos campos dinâmicos: {campo_id_uuid: valor}';
COMMENT ON COLUMN venda_produtos.localizador IS 'Código de reserva do fornecedor final (ex: AXCBBE da cia aérea)';
COMMENT ON COLUMN venda_produtos.localizador_fornecedor IS 'ID do consolidador/operadora (ex: pacote Orinter)';

CREATE INDEX idx_venda_produtos_venda ON venda_produtos(venda_id);
CREATE INDEX idx_venda_produtos_tipo ON venda_produtos(tipo_produto_id);
CREATE INDEX idx_venda_produtos_fornecedor ON venda_produtos(fornecedor_id);

-- ---------------------------------------------------------------------------
-- venda_produto_passageiros (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE venda_produto_passageiros (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_produto_id     uuid NOT NULL REFERENCES venda_produtos(id) ON DELETE CASCADE,
  venda_passageiro_id  uuid NOT NULL REFERENCES venda_passageiros(id) ON DELETE CASCADE,

  UNIQUE (venda_produto_id, venda_passageiro_id)
);

COMMENT ON TABLE venda_produto_passageiros IS 'Liga passageiros a produtos específicos (ex: só 2 dos 3 pax no hotel)';

CREATE INDEX idx_vpp_produto ON venda_produto_passageiros(venda_produto_id);
CREATE INDEX idx_vpp_passageiro ON venda_produto_passageiros(venda_passageiro_id);
