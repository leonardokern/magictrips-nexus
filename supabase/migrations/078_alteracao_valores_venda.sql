-- =============================================================================
-- 078 — Alteração de Valores de Venda
-- =============================================================================
-- Introduz o conceito de "venda do tipo alteração": uma venda secundária que
-- nasce vinculada a uma venda original aprovada e carrega no banco apenas as
-- DIFERENÇAS de valor (delta, podendo ser negativo). Dashboards que somam
-- vendas naturalmente refletem o total efetivo (original + alterações).
--
-- Decisões fechadas:
--   - Storage: delta puro em venda_produtos (valor_venda/valor_custo/rav pode
--     ser negativo).
--   - Identificador: sufixo "-A<N>" sobre o identificador da original
--     (MT-0019, MT-0019-A1, MT-0019-A2…).
--   - Edição permitida: valores dos produtos existentes + adicionar/remover
--     produtos. Cobrança não recadastrada inteira (só reflete o delta).
--
-- Componentes desta migration:
--   1. Schema: tipo_venda, venda_original_id + constraint de coerência.
--   2. Remove CHECK valor_venda/valor_custo >= 0 (delta pode ser negativo);
--      validação semântica vai pras RPCs.
--   3. RPC `obter_venda_para_alteracao` — read-only helper que retorna a
--      original + produtos + cliente + agente pra hidratar o wizard.
--   4. RPC `criar_alteracao_venda` — cria a alteração herdando metadados da
--      original e gravando deltas.
-- =============================================================================

-- ── 1. Schema ────────────────────────────────────────────────────────────────

ALTER TABLE vendas
  ADD COLUMN tipo_venda text NOT NULL DEFAULT 'original'
    CHECK (tipo_venda IN ('original', 'alteracao_valores')),
  ADD COLUMN venda_original_id uuid REFERENCES vendas(id);

CREATE INDEX idx_vendas_venda_original_id
  ON vendas(venda_original_id)
  WHERE tipo_venda = 'alteracao_valores';

ALTER TABLE vendas
  ADD CONSTRAINT vendas_tipo_coerencia CHECK (
    (tipo_venda = 'original'           AND venda_original_id IS NULL) OR
    (tipo_venda = 'alteracao_valores'  AND venda_original_id IS NOT NULL)
  );

-- ── 2. Relaxar CHECKs absolutos de valor ─────────────────────────────────────
-- Delta pode ser negativo. Validação de "original >= 0" fica nas RPCs
-- (criar_venda_completa rejeita valores negativos em vendas tipo 'original').

ALTER TABLE venda_produtos
  DROP CONSTRAINT IF EXISTS venda_produtos_valor_venda_check;

ALTER TABLE venda_produtos
  DROP CONSTRAINT IF EXISTS venda_produtos_valor_custo_check;

-- ── 3. RPC obter_venda_para_alteracao ────────────────────────────────────────
-- Retorna a venda aprovada + produtos + cliente + agente, em JSON, pra
-- hidratar o wizard de alteração. Bloqueia:
--   - venda não-aprovada
--   - venda em outra empresa
--   - venda que já é uma alteração (não permite encadeamento)

CREATE OR REPLACE FUNCTION public.obter_venda_para_alteracao(p_venda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_venda        record;
  v_user_emp     uuid[];
  v_cliente      jsonb;
  v_agente       jsonb;
  v_produtos     jsonb;
  v_passageiros  jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = '02000';
  END IF;

  v_user_emp := app_user_empresas();
  IF NOT (v_venda.empresa_id = ANY(v_user_emp)) THEN
    RAISE EXCEPTION 'Venda fora do escopo do usuário.' USING ERRCODE = '42501';
  END IF;

  IF v_venda.tipo_venda <> 'original' THEN
    RAISE EXCEPTION 'Só é possível alterar vendas originais (esta é %).', v_venda.tipo_venda USING ERRCODE = '22023';
  END IF;

  IF v_venda.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Só é possível alterar vendas aprovadas (status atual: %).', v_venda.status USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'tipo_pessoa', c.tipo_pessoa,
    'cpf', c.cpf, 'cnpj', c.cnpj,
    'razao_social', c.razao_social, 'nome_fantasia', c.nome_fantasia,
    'email', c.email, 'telefone', c.telefone
  ) INTO v_cliente
  FROM clientes c WHERE c.id = v_venda.cliente_id;

  SELECT jsonb_build_object('id', u.id, 'nome', u.nome)
    INTO v_agente
  FROM usuarios u WHERE u.id = v_venda.usuario_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', vp.id,
      'ordem', vp.ordem,
      'tipo_produto_id', vp.tipo_produto_id,
      'tipo_produto_nome', vp.tipo_produto_nome,
      'fornecedor_id', vp.fornecedor_id,
      'fornecedor_nome', vp.fornecedor_nome,
      'localizador', vp.localizador,
      'localizador_fornecedor', vp.localizador_fornecedor,
      'destino', vp.destino,
      'data_emissao', vp.data_emissao,
      'data_inicio_viagem', vp.data_inicio_viagem,
      'data_fim_viagem', vp.data_fim_viagem,
      'valores_extras', COALESCE(vp.valores_extras, '{}'::jsonb),
      'tipo_comissao', vp.tipo_comissao,
      'valor_venda', vp.valor_venda,
      'valor_custo', vp.valor_custo,
      'rav', vp.rav,
      'rav_extra_cliente', vp.rav_extra_cliente,
      'rav_extra_fornecedor', vp.rav_extra_fornecedor,
      'comissao_vendedor', vp.comissao_vendedor,
      'pgto_modo', vp.pgto_modo,
      'pgto_forma', vp.pgto_forma,
      'pgto_cartao_id', vp.pgto_cartao_id,
      'pgto_valor_total', vp.pgto_valor_total,
      'pgto_entrada', vp.pgto_entrada,
      'pgto_num_parcelas', vp.pgto_num_parcelas,
      'pgto_valor_parcela', vp.pgto_valor_parcela,
      'pgto_data_debito', vp.pgto_data_debito,
      'pgto_primeira_parcela_extra', vp.pgto_primeira_parcela_extra
    ) ORDER BY vp.ordem
  ) INTO v_produtos
  FROM venda_produtos vp WHERE vp.venda_id = p_venda_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', vp.id, 'ordem', vp.ordem, 'nome', vp.nome,
      'cpf', vp.cpf, 'data_nascimento', vp.data_nascimento,
      'passaporte', vp.passaporte
    ) ORDER BY vp.ordem
  ) INTO v_passageiros
  FROM venda_passageiros vp WHERE vp.venda_id = p_venda_id;

  RETURN jsonb_build_object(
    'id', v_venda.id,
    'identificador', v_venda.identificador,
    'empresa_id', v_venda.empresa_id,
    'cliente_id', v_venda.cliente_id,
    'usuario_id', v_venda.usuario_id,
    'data_venda', v_venda.data_venda,
    'pax', v_venda.pax,
    'origem', v_venda.origem,
    'observacoes', v_venda.observacoes,
    'indicacao_percentual', v_venda.indicacao_percentual,
    'comissao_percentual', v_venda.comissao_percentual,
    'status', v_venda.status,
    'cliente', v_cliente,
    'agente', v_agente,
    'produtos', COALESCE(v_produtos, '[]'::jsonb),
    'passageiros', COALESCE(v_passageiros, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION obter_venda_para_alteracao(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION obter_venda_para_alteracao(uuid) TO authenticated, service_role;

-- ── 4. RPC criar_alteracao_venda ─────────────────────────────────────────────
-- Cria uma venda do tipo 'alteracao_valores' vinculada a uma original
-- aprovada. Herda metadados da original. Aceita produtos com valores
-- delta (positivos ou negativos). Identificador = "<original>-A<N>".
--
-- Payload esperado:
--   {
--     "venda_original_id": uuid,
--     "produtos": [ { tipo_produto_id, valor_venda (delta), valor_custo (delta),
--                     rav (delta opcional), rav_extra_cliente, rav_extra_fornecedor,
--                     ...campos absolutos como fornecedor_id, datas, localizador,
--                     pgto_*, etc.} ],
--     "cobranca": { ... opcional, segue o mesmo shape de criar_venda_completa
--                       (só pra cobrar o delta total) }
--   }

CREATE OR REPLACE FUNCTION public.criar_alteracao_venda(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_original_id     uuid := nullif(p_payload->>'venda_original_id', '')::uuid;
  v_original        record;

  v_produtos        jsonb := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_cobranca        jsonb := p_payload->'cobranca';

  v_venda_id        uuid;
  v_cobranca_id     uuid;
  v_produto         jsonb;
  v_produto_id      uuid;
  v_item            jsonb;
  v_tipo_produto    record;

  v_perm_criar      text;
  v_perm_aprovar    text;
  v_auto_aprovado   boolean := false;
  v_status_inicial  text;
  v_user_empresas   uuid[];
  v_destinatario    record;

  v_num_alt         integer;
  v_identificador   text;
  v_observacoes     text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF v_original_id IS NULL THEN
    RAISE EXCEPTION 'venda_original_id obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT permissoes->'vendas'->>'criar', permissoes->'vendas'->>'aprovar'
    INTO v_perm_criar, v_perm_aprovar
  FROM usuarios u JOIN perfis_acesso p ON p.id = u.perfil_id
  WHERE u.id = v_uid;

  IF v_perm_criar IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Sem permissão para criar vendas.' USING ERRCODE = '42501';
  END IF;

  v_auto_aprovado := (v_perm_aprovar = 'true');
  v_status_inicial := CASE WHEN v_auto_aprovado THEN 'aprovado' ELSE 'pendente_validacao' END;

  -- Trava a original pra leitura consistente
  SELECT * INTO v_original FROM vendas WHERE id = v_original_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda original não encontrada.' USING ERRCODE = '02000';
  END IF;

  v_user_empresas := app_user_empresas();
  IF NOT (v_original.empresa_id = ANY(v_user_empresas)) THEN
    RAISE EXCEPTION 'Venda fora do escopo do usuário.' USING ERRCODE = '42501';
  END IF;

  IF v_original.tipo_venda <> 'original' THEN
    RAISE EXCEPTION 'Não é possível alterar uma alteração (venda % é %).', v_original.identificador, v_original.tipo_venda USING ERRCODE = '22023';
  END IF;

  IF v_original.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Só é possível alterar vendas aprovadas (status atual: %).', v_original.status USING ERRCODE = '22023';
  END IF;

  -- Gera identificador "<original>-A<N>"
  SELECT COUNT(*) + 1 INTO v_num_alt
  FROM vendas WHERE venda_original_id = v_original_id;
  v_identificador := v_original.identificador || '-A' || v_num_alt::text;

  v_observacoes := COALESCE(p_payload->>'observacoes', 'Alteração de valores referente a ' || v_original.identificador);

  -- INSERT venda herdando da original
  INSERT INTO vendas (
    empresa_id, usuario_id, cliente_id, identificador, data_venda, pax, origem,
    observacoes, status, indicacao_percentual, comissao_percentual,
    aprovado_por, data_aprovacao,
    tipo_venda, venda_original_id
  ) VALUES (
    v_original.empresa_id,
    v_original.usuario_id,
    v_original.cliente_id,
    v_identificador,
    CURRENT_DATE,
    v_original.pax,
    v_original.origem,
    v_observacoes,
    v_status_inicial,
    v_original.indicacao_percentual,
    v_original.comissao_percentual,
    CASE WHEN v_auto_aprovado THEN v_uid END,
    CASE WHEN v_auto_aprovado THEN now() END,
    'alteracao_valores',
    v_original_id
  )
  RETURNING id INTO v_venda_id;

  -- Insere produtos com valores delta (já vêm calculados do frontend)
  FOR v_produto IN SELECT * FROM jsonb_array_elements(v_produtos)
  LOOP
    SELECT id, nome INTO v_tipo_produto
    FROM tipos_produto
    WHERE id = (v_produto->>'tipo_produto_id')::uuid;

    INSERT INTO venda_produtos (
      venda_id, ordem,
      tipo_produto_id, tipo_produto_nome,
      fornecedor_id, fornecedor_nome,
      localizador, localizador_fornecedor, destino,
      data_emissao, data_inicio_viagem, data_fim_viagem,
      valores_extras, tipo_comissao,
      valor_venda, valor_custo,
      rav, rav_extra_cliente, rav_extra_fornecedor,
      comissao_vendedor,
      pgto_modo, pgto_forma, pgto_cartao_id, pgto_valor_total,
      pgto_entrada, pgto_num_parcelas, pgto_valor_parcela,
      pgto_data_debito, pgto_primeira_parcela_extra
    ) VALUES (
      v_venda_id,
      COALESCE((v_produto->>'ordem')::int, 1),
      v_tipo_produto.id,
      v_tipo_produto.nome,
      nullif(v_produto->>'fornecedor_id', '')::uuid,
      COALESCE(v_produto->>'fornecedor_nome', ''),
      v_produto->>'localizador',
      v_produto->>'localizador_fornecedor',
      v_produto->>'destino',
      nullif(v_produto->>'data_emissao', '')::date,
      nullif(v_produto->>'data_inicio_viagem', '')::date,
      nullif(v_produto->>'data_fim_viagem', '')::date,
      COALESCE(v_produto->'valores_extras', '{}'::jsonb),
      v_produto->>'tipo_comissao',
      COALESCE((v_produto->>'valor_venda')::numeric, 0),
      COALESCE((v_produto->>'valor_custo')::numeric, 0),
      nullif(v_produto->>'rav', '')::numeric,
      COALESCE((v_produto->>'rav_extra_cliente')::numeric, 0),
      COALESCE((v_produto->>'rav_extra_fornecedor')::numeric, 0),
      nullif(v_produto->>'comissao_vendedor', '')::numeric,
      COALESCE(v_produto->>'pgto_modo', 'comissionado'),
      v_produto->>'pgto_forma',
      nullif(v_produto->>'pgto_cartao_id', '')::uuid,
      nullif(v_produto->>'pgto_valor_total', '')::numeric,
      COALESCE((v_produto->>'pgto_entrada')::numeric, 0),
      COALESCE((v_produto->>'pgto_num_parcelas')::int, 1),
      nullif(v_produto->>'pgto_valor_parcela', '')::numeric,
      nullif(v_produto->>'pgto_data_debito', '')::date,
      COALESCE((v_produto->>'pgto_primeira_parcela_extra')::numeric, 0)
    )
    RETURNING id INTO v_produto_id;
  END LOOP;

  -- Passageiros: copia os da original (alteração não toca em passageiros)
  INSERT INTO venda_passageiros (venda_id, ordem, nome, cpf, data_nascimento, passaporte)
  SELECT v_venda_id, ordem, nome, cpf, data_nascimento, passaporte
  FROM venda_passageiros WHERE venda_id = v_original_id;

  -- Cobrança opcional (só do delta)
  IF v_cobranca IS NOT NULL THEN
    INSERT INTO cobranca_cliente (venda_id, valor_total, observacoes)
    VALUES (
      v_venda_id,
      (v_cobranca->>'valor_total')::numeric,
      v_cobranca->>'observacoes'
    )
    RETURNING id INTO v_cobranca_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_cobranca->'itens', '[]'::jsonb))
    LOOP
      INSERT INTO cobranca_cliente_itens (
        cobranca_id, tipo, valor_total, num_parcelas, valor_parcela,
        plataforma_link, plataforma, parcelas_detalhe,
        taxa_adquirente, valor_liquido, data_inicio, data_primeiro_recebimento,
        fornecedor_destino, observacoes,
        comprovante_storage_path, comprovante_nome_arquivo, comprovante_mime_type, comprovante_tamanho_bytes
      ) VALUES (
        v_cobranca_id, v_item->>'tipo', (v_item->>'valor_total')::numeric,
        COALESCE((v_item->>'num_parcelas')::int, 1), nullif(v_item->>'valor_parcela', '')::numeric,
        v_item->>'plataforma_link', nullif(v_item->>'plataforma', ''),
        COALESCE(v_item->'parcelas_detalhe', '[]'::jsonb),
        nullif(v_item->>'taxa_adquirente', '')::numeric, nullif(v_item->>'valor_liquido', '')::numeric,
        nullif(v_item->>'data_inicio', '')::date, nullif(v_item->>'data_primeiro_recebimento', '')::date,
        v_item->>'fornecedor_destino', v_item->>'observacoes',
        nullif(v_item->>'comprovante_storage_path', ''),
        nullif(v_item->>'comprovante_nome_arquivo', ''),
        nullif(v_item->>'comprovante_mime_type', ''),
        nullif(v_item->>'comprovante_tamanho_bytes', '')::int
      );
    END LOOP;
  END IF;

  -- Audit log de criação
  INSERT INTO audit_logs (
    usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois
  ) VALUES (
    v_uid, v_original.empresa_id, 'venda', v_venda_id, 'criar',
    jsonb_build_object(
      'identificador',     v_identificador,
      'tipo_venda',        'alteracao_valores',
      'venda_original_id', v_original_id,
      'usuario_id',        v_original.usuario_id,
      'cliente_id',        v_original.cliente_id,
      'status',            v_status_inicial
    )
  );

  IF v_auto_aprovado THEN
    PERFORM gerar_parcelas_receber(v_venda_id);
    INSERT INTO audit_logs (usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois)
    VALUES (v_uid, v_original.empresa_id, 'venda', v_venda_id, 'auto_aprovacao',
      jsonb_build_object('aprovado_por', v_uid, 'motivo', 'criação de alteração por usuário com permissão de aprovar'));
  ELSE
    FOR v_destinatario IN
      SELECT DISTINCT u.id
      FROM usuarios u
      JOIN perfis_acesso p ON p.id = u.perfil_id
      JOIN usuarios_empresas ue ON ue.usuario_id = u.id
      WHERE p.nome IN ('Administrador', 'Gerente')
        AND u.ativo = true
        AND ue.empresa_id = v_original.empresa_id
        AND u.id <> v_uid
    LOOP
      INSERT INTO lembretes (
        tipo, referencia_tipo, referencia_id,
        destinatario_id, empresa_id,
        data_lembrete, mensagem, status
      ) VALUES (
        'venda_pendente_validacao', 'venda', v_venda_id,
        v_destinatario.id, v_original.empresa_id,
        CURRENT_DATE,
        'Nova alteração de valores aguardando aprovação (' || v_identificador || ').',
        'pendente'
      );
    END LOOP;
  END IF;

  RETURN v_venda_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION criar_alteracao_venda(jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION criar_alteracao_venda(jsonb) TO authenticated, service_role;
