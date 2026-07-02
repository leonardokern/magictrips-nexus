-- =============================================================================
-- 093 — Pacotes (templates de venda reutilizáveis)
-- =============================================================================
-- Cadastro administrativo de pacotes turísticos pré-negociados que, ao serem
-- selecionados no Passo 2 da venda, pré-carregam produtos já preenchidos
-- (fornecedor, custo, datas de viagem) para o agente só completar valor de
-- venda, data de emissão e forma de pagamento.
--
-- Dois modos:
--   - unica_operadora: 1 fornecedor + 1 custo total para o pacote inteiro.
--     Vira UMA linha de produto na venda. `pacote_itens` funciona só como
--     checklist informativo (o que está incluso), sem fornecedor/custo.
--   - multi_operadora: cada item (produto) tem 1+ opções de fornecedor,
--     cada uma com seu próprio custo (ex: Aéreo com LATAM R$1000 ou GOL
--     R$800). Vira N linhas de produto na venda — se o item tiver mais de
--     uma opção, o agente escolhe qual usar ao aplicar o pacote.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabelas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE pacotes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES empresas(id),
  nome               TEXT NOT NULL,
  descricao          TEXT,
  tipo_pacote        TEXT NOT NULL CHECK (tipo_pacote IN ('unica_operadora', 'multi_operadora')),
  data_inicio_viagem DATE NOT NULL,
  data_fim_viagem    DATE NOT NULL,
  -- usados só quando tipo_pacote = 'unica_operadora' (1 linha de produto na venda)
  tipo_produto_id    UUID REFERENCES tipos_produto(id),
  fornecedor_id      UUID REFERENCES fornecedores(id),
  valor_custo_total  NUMERIC(12,2),
  valores_extras     JSONB NOT NULL DEFAULT '{}',
  ativo              BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID REFERENCES usuarios(id),
  CHECK (data_fim_viagem >= data_inicio_viagem)
);

CREATE TABLE pacote_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id       UUID NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,
  ordem           INT NOT NULL DEFAULT 0,
  tipo_produto_id UUID NOT NULL REFERENCES tipos_produto(id),
  descricao       TEXT,
  valores_extras  JSONB NOT NULL DEFAULT '{}', -- só usado quando o pacote pai é multi_operadora
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- só populada quando o pacote pai é multi_operadora: 1+ opções de fornecedor/custo por item
CREATE TABLE pacote_item_fornecedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_item_id  UUID NOT NULL REFERENCES pacote_itens(id) ON DELETE CASCADE,
  fornecedor_id   UUID NOT NULL REFERENCES fornecedores(id),
  valor_custo     NUMERIC(12,2) NOT NULL,
  ordem           INT NOT NULL DEFAULT 0,
  UNIQUE (pacote_item_id, fornecedor_id)
);

CREATE INDEX idx_pacotes_empresa ON pacotes (empresa_id);
CREATE INDEX idx_pacote_itens_pacote ON pacote_itens (pacote_id);
CREATE INDEX idx_pacote_item_fornecedores_item ON pacote_item_fornecedores (pacote_item_id);

-- Rastreabilidade: de qual pacote uma linha de venda_produtos se originou (opcional).
ALTER TABLE venda_produtos
  ADD COLUMN IF NOT EXISTS origem_pacote_id UUID REFERENCES pacotes(id);

COMMENT ON TABLE pacotes IS 'Templates reutilizáveis de venda — pré-carregam produtos no Passo 2.';
COMMENT ON COLUMN venda_produtos.origem_pacote_id IS 'Pacote que originou esta linha (rastreabilidade/relatórios), null se produto manual.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacote_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacote_item_fornecedores ENABLE ROW LEVEL SECURITY;

-- Leitura liberada a qualquer usuário autenticado da mesma empresa — igual
-- fornecedores/tipos_produto, que são dado de referência pro Passo 2 da
-- venda independente de o usuário ter a permissão "pacotes.ler".
CREATE POLICY pacotes_select ON pacotes
  FOR SELECT TO authenticated
  USING (mesma_empresa(empresa_id));

CREATE POLICY pacote_itens_select ON pacote_itens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pacotes p WHERE p.id = pacote_itens.pacote_id AND mesma_empresa(p.empresa_id)));

CREATE POLICY pacote_item_fornecedores_select ON pacote_item_fornecedores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacote_itens pi
      JOIN pacotes p ON p.id = pi.pacote_id
      WHERE pi.id = pacote_item_fornecedores.pacote_item_id AND mesma_empresa(p.empresa_id)
    )
  );

-- Escrita gated pela permissão JSONB do módulo "pacotes" (mesmo padrão de 055).
CREATE POLICY pacotes_write_criar ON pacotes
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('pacotes', 'criar'));
CREATE POLICY pacotes_write_editar ON pacotes
  FOR UPDATE TO authenticated
  USING (has_permissao('pacotes', 'editar'))
  WITH CHECK (has_permissao('pacotes', 'editar'));
CREATE POLICY pacotes_write_excluir ON pacotes
  FOR DELETE TO authenticated
  USING (has_permissao('pacotes', 'excluir'));

CREATE POLICY pacote_itens_write_criar ON pacote_itens
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('pacotes', 'criar') OR has_permissao('pacotes', 'editar'));
CREATE POLICY pacote_itens_write_editar ON pacote_itens
  FOR UPDATE TO authenticated
  USING (has_permissao('pacotes', 'editar'))
  WITH CHECK (has_permissao('pacotes', 'editar'));
CREATE POLICY pacote_itens_write_excluir ON pacote_itens
  FOR DELETE TO authenticated
  USING (has_permissao('pacotes', 'editar') OR has_permissao('pacotes', 'excluir'));

CREATE POLICY pacote_item_fornecedores_write_criar ON pacote_item_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (has_permissao('pacotes', 'criar') OR has_permissao('pacotes', 'editar'));
CREATE POLICY pacote_item_fornecedores_write_editar ON pacote_item_fornecedores
  FOR UPDATE TO authenticated
  USING (has_permissao('pacotes', 'editar'))
  WITH CHECK (has_permissao('pacotes', 'editar'));
CREATE POLICY pacote_item_fornecedores_write_excluir ON pacote_item_fornecedores
  FOR DELETE TO authenticated
  USING (has_permissao('pacotes', 'editar') OR has_permissao('pacotes', 'excluir'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPCs SECURITY DEFINER — criar/atualizar pacote com itens em uma chamada
--    (a autorização real é checada no Server Action via can(), igual padrão
--    de criar_fornecedor/atualizar_fornecedor em 052)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION criar_pacote(
  p_empresa_id         uuid,
  p_nome               text,
  p_descricao          text,
  p_tipo_pacote        text,
  p_data_inicio_viagem date,
  p_data_fim_viagem    date,
  p_tipo_produto_id    uuid DEFAULT NULL,
  p_fornecedor_id      uuid DEFAULT NULL,
  p_valor_custo_total  numeric DEFAULT NULL,
  p_valores_extras     jsonb DEFAULT '{}',
  p_itens              jsonb DEFAULT '[]',
  p_created_by         uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      uuid;
  v_item    jsonb;
  v_item_id uuid;
  v_forn    jsonb;
BEGIN
  INSERT INTO pacotes (
    empresa_id, nome, descricao, tipo_pacote,
    data_inicio_viagem, data_fim_viagem,
    tipo_produto_id, fornecedor_id, valor_custo_total, valores_extras,
    created_by
  ) VALUES (
    p_empresa_id, p_nome, p_descricao, p_tipo_pacote,
    p_data_inicio_viagem, p_data_fim_viagem,
    p_tipo_produto_id, p_fornecedor_id, p_valor_custo_total, COALESCE(p_valores_extras, '{}'::jsonb),
    p_created_by
  )
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    INSERT INTO pacote_itens (pacote_id, ordem, tipo_produto_id, descricao, valores_extras)
    VALUES (
      v_id,
      COALESCE((v_item->>'ordem')::int, 0),
      (v_item->>'tipo_produto_id')::uuid,
      v_item->>'descricao',
      COALESCE(v_item->'valores_extras', '{}'::jsonb)
    )
    RETURNING id INTO v_item_id;

    FOR v_forn IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'fornecedores', '[]'::jsonb))
    LOOP
      INSERT INTO pacote_item_fornecedores (pacote_item_id, fornecedor_id, valor_custo, ordem)
      VALUES (
        v_item_id,
        (v_forn->>'fornecedor_id')::uuid,
        (v_forn->>'valor_custo')::numeric,
        COALESCE((v_forn->>'ordem')::int, 0)
      );
    END LOOP;
  END LOOP;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION atualizar_pacote(
  p_id                 uuid,
  p_nome               text,
  p_descricao          text,
  p_tipo_pacote        text,
  p_data_inicio_viagem date,
  p_data_fim_viagem    date,
  p_tipo_produto_id    uuid DEFAULT NULL,
  p_fornecedor_id      uuid DEFAULT NULL,
  p_valor_custo_total  numeric DEFAULT NULL,
  p_valores_extras     jsonb DEFAULT '{}',
  p_itens              jsonb DEFAULT '[]'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    jsonb;
  v_item_id uuid;
  v_forn    jsonb;
BEGIN
  UPDATE pacotes
  SET
    nome               = p_nome,
    descricao          = p_descricao,
    tipo_pacote        = p_tipo_pacote,
    data_inicio_viagem = p_data_inicio_viagem,
    data_fim_viagem    = p_data_fim_viagem,
    tipo_produto_id    = p_tipo_produto_id,
    fornecedor_id      = p_fornecedor_id,
    valor_custo_total  = p_valor_custo_total,
    valores_extras     = COALESCE(p_valores_extras, '{}'::jsonb),
    updated_at         = now()
  WHERE id = p_id;

  -- Substitui itens (delete + insert) — pacote_item_fornecedores cai em cascata.
  DELETE FROM pacote_itens WHERE pacote_id = p_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    INSERT INTO pacote_itens (pacote_id, ordem, tipo_produto_id, descricao, valores_extras)
    VALUES (
      p_id,
      COALESCE((v_item->>'ordem')::int, 0),
      (v_item->>'tipo_produto_id')::uuid,
      v_item->>'descricao',
      COALESCE(v_item->'valores_extras', '{}'::jsonb)
    )
    RETURNING id INTO v_item_id;

    FOR v_forn IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'fornecedores', '[]'::jsonb))
    LOOP
      INSERT INTO pacote_item_fornecedores (pacote_item_id, fornecedor_id, valor_custo, ordem)
      VALUES (
        v_item_id,
        (v_forn->>'fornecedor_id')::uuid,
        (v_forn->>'valor_custo')::numeric,
        COALESCE((v_forn->>'ordem')::int, 0)
      );
    END LOOP;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_pacote(uuid, text, text, text, date, date, uuid, uuid, numeric, jsonb, jsonb, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.criar_pacote(uuid, text, text, text, date, date, uuid, uuid, numeric, jsonb, jsonb, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atualizar_pacote(uuid, text, text, text, date, date, uuid, uuid, numeric, jsonb, jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.atualizar_pacote(uuid, text, text, text, date, date, uuid, uuid, numeric, jsonb, jsonb) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. criar_venda_completa / editar_venda_completa — passam origem_pacote_id
--    adiante quando a linha de produto veio de um pacote aplicado no Passo 2.
--    CREATE OR REPLACE preservando o corpo atual (ver histórico de migrations
--    046/047/060/078/079/082/090), só adicionando a coluna nova no INSERT.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.criar_venda_completa(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa_id uuid := (p_payload->>'empresa_id')::uuid;
  v_data_venda date := (p_payload->>'data_venda')::date;
  v_cliente_id uuid := nullif(p_payload->>'cliente_id', '')::uuid;
  v_cliente_novo jsonb := p_payload->'cliente_novo';
  v_pax int := COALESCE((p_payload->>'pax')::int, 1);
  v_origem text := p_payload->>'origem';
  v_indicacao numeric := nullif(p_payload->>'indicacao_percentual', '')::numeric;
  v_comissao_perc numeric := nullif(p_payload->>'comissao_percentual', '')::numeric;
  v_observacoes text := p_payload->>'observacoes';
  v_usuario_id uuid := COALESCE(nullif(p_payload->>'usuario_id', '')::uuid, v_uid);
  v_produtos jsonb := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_passageiros jsonb := COALESCE(p_payload->'passageiros', '[]'::jsonb);
  v_cobranca jsonb := p_payload->'cobranca';
  v_venda_id uuid; v_cobranca_id uuid; v_produto jsonb; v_produto_id uuid;
  v_passageiro jsonb; v_passageiro_id uuid; v_item jsonb; v_tipo_produto record;
  v_passageiros_ids uuid[] := ARRAY[]::uuid[];
  v_perm_criar text; v_user_empresas uuid[]; v_destinatario record; v_tp text;
  v_num_venda integer; v_prefixo text; v_identificador text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501'; END IF;
  SELECT permissoes->'vendas'->>'criar' INTO v_perm_criar FROM usuarios u JOIN perfis_acesso p ON p.id = u.perfil_id WHERE u.id = v_uid;
  IF v_perm_criar IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  v_user_empresas := app_user_empresas();
  IF NOT (v_empresa_id = ANY(v_user_empresas)) THEN RAISE EXCEPTION 'Empresa fora do escopo.' USING ERRCODE = '42501'; END IF;
  IF v_cliente_id IS NULL AND v_cliente_novo IS NULL THEN RAISE EXCEPTION 'Cliente obrigatório.' USING ERRCODE = '22023'; END IF;

  IF v_cliente_id IS NULL THEN
    v_tp := COALESCE(v_cliente_novo->>'tipo_pessoa', 'fisica');
    IF v_tp = 'fisica' THEN
      SELECT id INTO v_cliente_id FROM clientes WHERE empresa_id = v_empresa_id AND cpf = v_cliente_novo->>'cpf';
      IF v_cliente_id IS NULL THEN
        INSERT INTO clientes (empresa_id, tipo_pessoa, nome, cpf, data_nascimento, passaporte, estrangeiro, email, telefone, tipo, dia_faturamento)
        VALUES (v_empresa_id, 'fisica', v_cliente_novo->>'nome', v_cliente_novo->>'cpf', nullif(v_cliente_novo->>'data_nascimento','')::date, nullif(v_cliente_novo->>'passaporte',''), COALESCE((v_cliente_novo->>'estrangeiro')::boolean, false), v_cliente_novo->>'email', v_cliente_novo->>'telefone', COALESCE(v_cliente_novo->>'tipo','regular'), nullif(v_cliente_novo->>'dia_faturamento','')::int)
        RETURNING id INTO v_cliente_id;
      END IF;
    ELSE
      SELECT id INTO v_cliente_id FROM clientes WHERE empresa_id = v_empresa_id AND cnpj = v_cliente_novo->>'cnpj';
      IF v_cliente_id IS NULL THEN
        INSERT INTO clientes (empresa_id, tipo_pessoa, nome, razao_social, nome_fantasia, cnpj, responsavel, email, telefone, tipo, dia_faturamento)
        VALUES (v_empresa_id, 'juridica', COALESCE(v_cliente_novo->>'razao_social', v_cliente_novo->>'nome_fantasia'), v_cliente_novo->>'razao_social', v_cliente_novo->>'nome_fantasia', v_cliente_novo->>'cnpj', v_cliente_novo->>'responsavel', v_cliente_novo->>'email', v_cliente_novo->>'telefone', COALESCE(v_cliente_novo->>'tipo','regular'), nullif(v_cliente_novo->>'dia_faturamento','')::int)
        RETURNING id INTO v_cliente_id;
      END IF;
    END IF;
  END IF;

  SELECT CASE slug WHEN 'magic-trips' THEN 'MT' WHEN 'del-mondo' THEN 'DM' ELSE upper(left(slug, 2)) END INTO v_prefixo FROM empresas WHERE id = v_empresa_id;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(identificador, '^[A-Z]+-', ''), '')::int), 0) + 1 INTO v_num_venda FROM vendas WHERE empresa_id = v_empresa_id AND identificador ~ '^[A-Z]+-\d+$';
  v_identificador := v_prefixo || '-' || lpad(v_num_venda::text, 4, '0');

  INSERT INTO vendas (empresa_id, usuario_id, cliente_id, identificador, data_venda, pax, origem, observacoes, status, indicacao_percentual, comissao_percentual, aprovado_por, data_aprovacao)
  VALUES (v_empresa_id, v_usuario_id, v_cliente_id, v_identificador, v_data_venda, v_pax, v_origem, v_observacoes, 'pendente_validacao', v_indicacao, v_comissao_perc, NULL, NULL)
  RETURNING id INTO v_venda_id;

  FOR v_produto IN SELECT * FROM jsonb_array_elements(v_produtos) LOOP
    SELECT id, nome INTO v_tipo_produto FROM tipos_produto WHERE id = (v_produto->>'tipo_produto_id')::uuid;
    INSERT INTO venda_produtos (
      venda_id, ordem, tipo_produto_id, tipo_produto_nome, fornecedor_id, fornecedor_nome,
      localizador, localizador_fornecedor, destino, data_emissao, data_inicio_viagem, data_fim_viagem,
      valores_extras, tipo_comissao, valor_venda, valor_custo, rav,
      rav_extra_cliente, rav_extra_fornecedor, rav_comissionado,
      comissao_vendedor, pgto_modo, pgto_forma, pgto_cartao_id, pgto_valor_total,
      pgto_entrada, pgto_num_parcelas, pgto_valor_parcela, pgto_data_debito, pgto_primeira_parcela_extra,
      pgto_parcelas_detalhe, origem_pacote_id
    ) VALUES (
      v_venda_id, COALESCE((v_produto->>'ordem')::int, 1), v_tipo_produto.id, v_tipo_produto.nome,
      nullif(v_produto->>'fornecedor_id', '')::uuid, COALESCE(v_produto->>'fornecedor_nome', ''),
      v_produto->>'localizador', v_produto->>'localizador_fornecedor', v_produto->>'destino',
      nullif(v_produto->>'data_emissao', '')::date, nullif(v_produto->>'data_inicio_viagem', '')::date, nullif(v_produto->>'data_fim_viagem', '')::date,
      COALESCE(v_produto->'valores_extras', '{}'::jsonb), v_produto->>'tipo_comissao',
      (v_produto->>'valor_venda')::numeric, (v_produto->>'valor_custo')::numeric,
      nullif(v_produto->>'rav', '')::numeric,
      COALESCE((v_produto->>'rav_extra_cliente')::numeric, 0),
      COALESCE((v_produto->>'rav_extra_fornecedor')::numeric, 0),
      COALESCE((v_produto->>'rav_comissionado')::numeric, 0),
      nullif(v_produto->>'comissao_vendedor', '')::numeric, COALESCE(v_produto->>'pgto_modo', 'comissionado'),
      v_produto->>'pgto_forma', nullif(v_produto->>'pgto_cartao_id', '')::uuid, nullif(v_produto->>'pgto_valor_total', '')::numeric,
      COALESCE((v_produto->>'pgto_entrada')::numeric, 0), COALESCE((v_produto->>'pgto_num_parcelas')::int, 1),
      nullif(v_produto->>'pgto_valor_parcela', '')::numeric, nullif(v_produto->>'pgto_data_debito', '')::date,
      COALESCE((v_produto->>'pgto_primeira_parcela_extra')::numeric, 0),
      COALESCE(v_produto->'pgto_parcelas_detalhe', '[]'::jsonb),
      nullif(v_produto->>'origem_pacote_id', '')::uuid
    ) RETURNING id INTO v_produto_id;
  END LOOP;

  IF jsonb_array_length(v_passageiros) = 0 THEN
    INSERT INTO venda_passageiros (venda_id, nome, ordem) VALUES (v_venda_id, '(sem nome)', 1) RETURNING id INTO v_passageiro_id;
    v_passageiros_ids := array_append(v_passageiros_ids, v_passageiro_id);
  ELSE
    FOR v_passageiro IN SELECT * FROM jsonb_array_elements(v_passageiros) LOOP
      INSERT INTO venda_passageiros (venda_id, ordem, nome, cpf, data_nascimento, passaporte)
      VALUES (v_venda_id, COALESCE((v_passageiro->>'ordem')::int, 1), COALESCE(v_passageiro->>'nome', '(sem nome)'), v_passageiro->>'cpf', nullif(v_passageiro->>'data_nascimento', '')::date, nullif(v_passageiro->>'passaporte', ''))
      RETURNING id INTO v_passageiro_id;
      v_passageiros_ids := array_append(v_passageiros_ids, v_passageiro_id);
    END LOOP;
  END IF;

  IF v_cobranca IS NOT NULL AND jsonb_typeof(v_cobranca) = 'object' THEN
    INSERT INTO cobranca_cliente (venda_id, valor_total, observacoes) VALUES (v_venda_id, (v_cobranca->>'valor_total')::numeric, v_cobranca->>'observacoes') RETURNING id INTO v_cobranca_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_cobranca->'itens', '[]'::jsonb)) LOOP
      INSERT INTO cobranca_cliente_itens (
        cobranca_id, tipo, valor_total, num_parcelas, valor_parcela,
        plataforma_link, plataforma, parcelas_detalhe, taxa_cobranca,
        taxa_adquirente, valor_liquido, data_inicio, data_primeiro_recebimento,
        fornecedor_destino, observacoes,
        comprovante_storage_path, comprovante_nome_arquivo, comprovante_mime_type, comprovante_tamanho_bytes
      ) VALUES (
        v_cobranca_id, v_item->>'tipo', (v_item->>'valor_total')::numeric,
        COALESCE((v_item->>'num_parcelas')::int, 1), nullif(v_item->>'valor_parcela', '')::numeric,
        v_item->>'plataforma_link', nullif(v_item->>'plataforma', ''),
        COALESCE(v_item->'parcelas_detalhe', '[]'::jsonb),
        COALESCE((v_item->>'taxa_cobranca')::numeric, 0),
        nullif(v_item->>'taxa_adquirente', '')::numeric, nullif(v_item->>'valor_liquido', '')::numeric,
        nullif(v_item->>'data_inicio', '')::date, nullif(v_item->>'data_primeiro_recebimento', '')::date,
        v_item->>'fornecedor_destino', v_item->>'observacoes',
        nullif(v_item->>'comprovante_storage_path', ''), nullif(v_item->>'comprovante_nome_arquivo', ''),
        nullif(v_item->>'comprovante_mime_type', ''), nullif(v_item->>'comprovante_tamanho_bytes', '')::int
      );
    END LOOP;
  END IF;

  FOR v_destinatario IN
    SELECT DISTINCT u.id FROM usuarios u JOIN perfis_acesso p ON p.id = u.perfil_id JOIN usuarios_empresas ue ON ue.usuario_id = u.id
    WHERE p.nome IN ('Administrador', 'Gerente') AND u.ativo = true AND ue.empresa_id = v_empresa_id AND u.id <> v_uid
  LOOP
    INSERT INTO lembretes (tipo, referencia_tipo, referencia_id, destinatario_id, empresa_id, data_lembrete, mensagem, status)
    VALUES ('venda_pendente_validacao', 'venda', v_venda_id, v_destinatario.id, v_empresa_id, CURRENT_DATE, 'Nova venda aguardando aprovação.', 'pendente');
  END LOOP;

  INSERT INTO audit_logs (usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois)
  VALUES (v_uid, v_empresa_id, 'venda', v_venda_id, 'criar', jsonb_build_object('identificador', v_identificador, 'status_novo', 'pendente_validacao'));
  RETURN v_venda_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.editar_venda_completa(p_venda_id uuid, p_payload jsonb, p_aprovar boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_venda record;
  v_produtos jsonb := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_passageiros jsonb := COALESCE(p_payload->'passageiros', '[]'::jsonb);
  v_cobranca jsonb := p_payload->'cobranca';
  v_produto jsonb; v_passageiro jsonb; v_item jsonb; v_tipo_produto record;
  v_cobranca_id uuid; v_perm_aprovar text; v_aprovou boolean := false;
  v_identificador text; v_empresa_id uuid; v_status_anterior text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = '02000'; END IF;
  v_status_anterior := v_venda.status; v_identificador := v_venda.identificador; v_empresa_id := v_venda.empresa_id;

  UPDATE vendas SET
    cliente_id = COALESCE(nullif(p_payload->>'cliente_id', '')::uuid, cliente_id),
    data_venda = COALESCE((p_payload->>'data_venda')::date, data_venda),
    pax = COALESCE((p_payload->>'pax')::int, pax),
    origem = COALESCE(p_payload->>'origem', origem),
    observacoes = p_payload->>'observacoes',
    indicacao_percentual = COALESCE(nullif(p_payload->>'indicacao_percentual', '')::numeric, indicacao_percentual),
    comissao_percentual = COALESCE(nullif(p_payload->>'comissao_percentual', '')::numeric, comissao_percentual),
    usuario_id = COALESCE(nullif(p_payload->>'usuario_id', '')::uuid, usuario_id)
  WHERE id = p_venda_id;

  DELETE FROM venda_produtos WHERE venda_id = p_venda_id;
  FOR v_produto IN SELECT * FROM jsonb_array_elements(v_produtos) LOOP
    SELECT id, nome INTO v_tipo_produto FROM tipos_produto WHERE id = (v_produto->>'tipo_produto_id')::uuid;
    INSERT INTO venda_produtos (
      venda_id, ordem, tipo_produto_id, tipo_produto_nome, fornecedor_id, fornecedor_nome,
      localizador, localizador_fornecedor, destino, data_emissao, data_inicio_viagem, data_fim_viagem,
      valores_extras, tipo_comissao, valor_venda, valor_custo, rav,
      rav_extra_cliente, rav_extra_fornecedor, rav_comissionado,
      comissao_vendedor, pgto_modo, pgto_forma, pgto_cartao_id, pgto_valor_total,
      pgto_entrada, pgto_num_parcelas, pgto_valor_parcela, pgto_data_debito, pgto_primeira_parcela_extra,
      pgto_parcelas_detalhe, origem_pacote_id
    ) VALUES (
      p_venda_id, COALESCE((v_produto->>'ordem')::int, 1), v_tipo_produto.id, v_tipo_produto.nome,
      nullif(v_produto->>'fornecedor_id', '')::uuid, COALESCE(v_produto->>'fornecedor_nome', ''),
      v_produto->>'localizador', v_produto->>'localizador_fornecedor', v_produto->>'destino',
      nullif(v_produto->>'data_emissao', '')::date, nullif(v_produto->>'data_inicio_viagem', '')::date, nullif(v_produto->>'data_fim_viagem', '')::date,
      COALESCE(v_produto->'valores_extras', '{}'::jsonb), v_produto->>'tipo_comissao',
      (v_produto->>'valor_venda')::numeric, (v_produto->>'valor_custo')::numeric,
      nullif(v_produto->>'rav', '')::numeric,
      COALESCE((v_produto->>'rav_extra_cliente')::numeric, 0),
      COALESCE((v_produto->>'rav_extra_fornecedor')::numeric, 0),
      COALESCE((v_produto->>'rav_comissionado')::numeric, 0),
      nullif(v_produto->>'comissao_vendedor', '')::numeric, COALESCE(v_produto->>'pgto_modo', 'comissionado'),
      v_produto->>'pgto_forma', nullif(v_produto->>'pgto_cartao_id', '')::uuid, nullif(v_produto->>'pgto_valor_total', '')::numeric,
      COALESCE((v_produto->>'pgto_entrada')::numeric, 0), COALESCE((v_produto->>'pgto_num_parcelas')::int, 1),
      nullif(v_produto->>'pgto_valor_parcela', '')::numeric, nullif(v_produto->>'pgto_data_debito', '')::date,
      COALESCE((v_produto->>'pgto_primeira_parcela_extra')::numeric, 0),
      COALESCE(v_produto->'pgto_parcelas_detalhe', '[]'::jsonb),
      nullif(v_produto->>'origem_pacote_id', '')::uuid
    );
  END LOOP;

  DELETE FROM venda_passageiros WHERE venda_id = p_venda_id;
  IF jsonb_array_length(v_passageiros) = 0 THEN
    INSERT INTO venda_passageiros (venda_id, nome, ordem) VALUES (p_venda_id, '(sem nome)', 1);
  ELSE
    FOR v_passageiro IN SELECT * FROM jsonb_array_elements(v_passageiros) LOOP
      INSERT INTO venda_passageiros (venda_id, ordem, nome, cpf, data_nascimento, passaporte)
      VALUES (p_venda_id, COALESCE((v_passageiro->>'ordem')::int, 1), COALESCE(v_passageiro->>'nome', '(sem nome)'), v_passageiro->>'cpf', nullif(v_passageiro->>'data_nascimento', '')::date, nullif(v_passageiro->>'passaporte', ''));
    END LOOP;
  END IF;

  DELETE FROM cobranca_cliente WHERE venda_id = p_venda_id;
  IF v_cobranca IS NOT NULL AND jsonb_typeof(v_cobranca) = 'object' THEN
    INSERT INTO cobranca_cliente (venda_id, valor_total, observacoes) VALUES (p_venda_id, (v_cobranca->>'valor_total')::numeric, v_cobranca->>'observacoes') RETURNING id INTO v_cobranca_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_cobranca->'itens', '[]'::jsonb)) LOOP
      INSERT INTO cobranca_cliente_itens (
        cobranca_id, tipo, valor_total, num_parcelas, valor_parcela,
        plataforma_link, plataforma, parcelas_detalhe, taxa_cobranca,
        taxa_adquirente, valor_liquido, data_inicio, data_primeiro_recebimento,
        fornecedor_destino, observacoes,
        comprovante_storage_path, comprovante_nome_arquivo, comprovante_mime_type, comprovante_tamanho_bytes
      ) VALUES (
        v_cobranca_id, v_item->>'tipo', (v_item->>'valor_total')::numeric,
        COALESCE((v_item->>'num_parcelas')::int, 1), nullif(v_item->>'valor_parcela', '')::numeric,
        v_item->>'plataforma_link', nullif(v_item->>'plataforma', ''),
        COALESCE(v_item->'parcelas_detalhe', '[]'::jsonb),
        COALESCE((v_item->>'taxa_cobranca')::numeric, 0),
        nullif(v_item->>'taxa_adquirente', '')::numeric, nullif(v_item->>'valor_liquido', '')::numeric,
        nullif(v_item->>'data_inicio', '')::date, nullif(v_item->>'data_primeiro_recebimento', '')::date,
        v_item->>'fornecedor_destino', v_item->>'observacoes',
        nullif(v_item->>'comprovante_storage_path', ''), nullif(v_item->>'comprovante_nome_arquivo', ''),
        nullif(v_item->>'comprovante_mime_type', ''), nullif(v_item->>'comprovante_tamanho_bytes', '')::int
      );
    END LOOP;
  END IF;

  IF p_aprovar THEN
    SELECT permissoes->'vendas'->>'aprovar' INTO v_perm_aprovar FROM usuarios u JOIN perfis_acesso p ON p.id = u.perfil_id WHERE u.id = v_uid;
    IF v_perm_aprovar = 'true' THEN
      UPDATE vendas SET status = 'aprovado', aprovado_por = v_uid, data_aprovacao = now(), motivo_revisao = NULL WHERE id = p_venda_id;
      PERFORM gerar_parcelas_receber(p_venda_id);
      PERFORM gerar_parcelas_pagar(p_venda_id);
      v_aprovou := true;
    END IF;
  END IF;

  INSERT INTO audit_logs (usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois)
  VALUES (v_uid, v_empresa_id, 'venda', p_venda_id, 'editar', jsonb_build_object('identificador', v_identificador, 'status_anterior', v_status_anterior));
  IF v_aprovou THEN
    INSERT INTO audit_logs (usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois)
    VALUES (v_uid, v_empresa_id, 'venda', p_venda_id, 'aprovar', jsonb_build_object('identificador', v_identificador, 'status_anterior', v_status_anterior, 'status_novo', 'aprovado', 'via', 'editar_venda_completa'));
  END IF;
END; $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Permissão "pacotes" em perfis_acesso (mesmo padrão de 075)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'::jsonb),
  '{pacotes}',
  '{"ler": true, "criar": true, "editar": true, "excluir": true}'::jsonb,
  true
)
WHERE chave_sistema = 'admin';

UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'::jsonb),
  '{pacotes}',
  '{"ler": true, "criar": true, "editar": true, "excluir": true}'::jsonb,
  true
)
WHERE chave_sistema = 'gerente';

UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'::jsonb),
  '{pacotes}',
  '{"ler": false, "criar": false, "editar": false, "excluir": false}'::jsonb,
  true
)
WHERE chave_sistema IS DISTINCT FROM 'admin'
  AND chave_sistema IS DISTINCT FROM 'gerente'
  AND NOT (COALESCE(permissoes, '{}'::jsonb) ? 'pacotes');
