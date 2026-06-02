-- =============================================================================
-- 061 — Atualiza criar_venda_completa e editar_venda_completa para gravar
--       pgto_primeira_parcela_extra
-- =============================================================================
-- Acresce ao INSERT em `venda_produtos` o novo campo de taxa adicional na
-- primeira parcela. Mantém todas as demais regras intactas — só adiciona
-- uma coluna ao INSERT existente.
-- =============================================================================

-- Como as funções têm CORPO grande, usamos uma abordagem incremental:
-- recriamos só as funções afetadas, copiando a versão mais recente
-- (045_auto_aprovacao_e_excluir.sql e 042_editar_venda_completa.sql) e
-- acrescentando o novo campo.

-- ── criar_venda_completa ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.criar_venda_completa(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid            uuid    := auth.uid();
  v_empresa_id     uuid    := (p_payload->>'empresa_id')::uuid;
  v_data_venda     date    := (p_payload->>'data_venda')::date;
  v_cliente_id     uuid    := nullif(p_payload->>'cliente_id', '')::uuid;
  v_cliente_novo   jsonb   := p_payload->'cliente_novo';
  v_pax            int     := COALESCE((p_payload->>'pax')::int, 1);
  v_origem         text    := p_payload->>'origem';
  v_indicacao      numeric := nullif(p_payload->>'indicacao_percentual', '')::numeric;
  v_comissao_perc  numeric := nullif(p_payload->>'comissao_percentual', '')::numeric;
  v_observacoes    text    := p_payload->>'observacoes';
  v_usuario_id     uuid    := COALESCE(nullif(p_payload->>'usuario_id', '')::uuid, v_uid);

  v_produtos       jsonb   := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_passageiros    jsonb   := COALESCE(p_payload->'passageiros', '[]'::jsonb);
  v_cobranca       jsonb   := p_payload->'cobranca';

  v_venda_id       uuid;
  v_cobranca_id    uuid;
  v_produto        jsonb;
  v_produto_id     uuid;
  v_passageiro     jsonb;
  v_passageiro_id  uuid;
  v_item           jsonb;
  v_tipo_produto   record;
  v_passageiros_ids uuid[] := ARRAY[]::uuid[];

  v_perm_criar     text;
  v_perm_aprovar   text;
  v_auto_aprovado  boolean := false;
  v_status_inicial text;
  v_user_empresas  uuid[];
  v_destinatario   record;
  v_tp             text;

  v_num_venda      integer;
  v_prefixo        text;
  v_identificador  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
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

  v_user_empresas := app_user_empresas();
  IF NOT (v_empresa_id = ANY(v_user_empresas)) THEN
    RAISE EXCEPTION 'Empresa fora do escopo do usuário.' USING ERRCODE = '42501';
  END IF;

  IF v_cliente_id IS NULL AND v_cliente_novo IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF v_cliente_id IS NULL THEN
    v_tp := COALESCE(v_cliente_novo->>'tipo_pessoa', 'fisica');

    IF v_tp = 'fisica' THEN
      SELECT id INTO v_cliente_id
      FROM clientes
      WHERE empresa_id = v_empresa_id AND cpf = v_cliente_novo->>'cpf';
      IF v_cliente_id IS NULL THEN
        INSERT INTO clientes (
          empresa_id, tipo_pessoa, nome, cpf, data_nascimento,
          email, telefone, tipo, dia_faturamento
        ) VALUES (
          v_empresa_id, 'fisica',
          v_cliente_novo->>'nome',
          v_cliente_novo->>'cpf',
          nullif(v_cliente_novo->>'data_nascimento','')::date,
          v_cliente_novo->>'email',
          v_cliente_novo->>'telefone',
          COALESCE(v_cliente_novo->>'tipo','regular'),
          nullif(v_cliente_novo->>'dia_faturamento','')::int
        )
        RETURNING id INTO v_cliente_id;
      END IF;
    ELSE
      SELECT id INTO v_cliente_id
      FROM clientes
      WHERE empresa_id = v_empresa_id AND cnpj = v_cliente_novo->>'cnpj';
      IF v_cliente_id IS NULL THEN
        INSERT INTO clientes (
          empresa_id, tipo_pessoa, nome, razao_social, nome_fantasia, cnpj, responsavel,
          email, telefone, tipo, dia_faturamento
        ) VALUES (
          v_empresa_id, 'juridica',
          COALESCE(v_cliente_novo->>'razao_social', v_cliente_novo->>'nome_fantasia'),
          v_cliente_novo->>'razao_social',
          v_cliente_novo->>'nome_fantasia',
          v_cliente_novo->>'cnpj',
          v_cliente_novo->>'responsavel',
          v_cliente_novo->>'email',
          v_cliente_novo->>'telefone',
          COALESCE(v_cliente_novo->>'tipo','regular'),
          nullif(v_cliente_novo->>'dia_faturamento','')::int
        )
        RETURNING id INTO v_cliente_id;
      END IF;
    END IF;
  END IF;

  -- Identificador sequencial (MT-XXXX / DM-XXXX)
  SELECT CASE slug
    WHEN 'magic-trips' THEN 'MT'
    WHEN 'del-mondo'   THEN 'DM'
    ELSE upper(left(slug, 2))
  END INTO v_prefixo
  FROM empresas WHERE id = v_empresa_id;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(identificador, '^[A-Z]+-', ''), '')::int), 0) + 1
    INTO v_num_venda
  FROM vendas
  WHERE empresa_id = v_empresa_id AND identificador ~ '^[A-Z]+-\d+$';

  v_identificador := v_prefixo || '-' || lpad(v_num_venda::text, 4, '0');

  INSERT INTO vendas (
    empresa_id, usuario_id, cliente_id, identificador, data_venda, pax, origem,
    observacoes, status, indicacao_percentual, comissao_percentual,
    aprovado_por, data_aprovacao
  ) VALUES (
    v_empresa_id, v_usuario_id, v_cliente_id, v_identificador, v_data_venda, v_pax, v_origem,
    v_observacoes, v_status_inicial, v_indicacao, v_comissao_perc,
    CASE WHEN v_auto_aprovado THEN v_uid END,
    CASE WHEN v_auto_aprovado THEN now() END
  )
  RETURNING id INTO v_venda_id;

  -- Produtos
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
      (v_produto->>'valor_venda')::numeric,
      (v_produto->>'valor_custo')::numeric,
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

  -- Passageiros
  IF jsonb_array_length(v_passageiros) = 0 THEN
    INSERT INTO venda_passageiros (venda_id, nome, ordem)
    VALUES (v_venda_id, '(sem nome)', 1)
    RETURNING id INTO v_passageiro_id;
    v_passageiros_ids := array_append(v_passageiros_ids, v_passageiro_id);
  ELSE
    FOR v_passageiro IN SELECT * FROM jsonb_array_elements(v_passageiros)
    LOOP
      INSERT INTO venda_passageiros (
        venda_id, ordem, nome, cpf, data_nascimento
      ) VALUES (
        v_venda_id,
        COALESCE((v_passageiro->>'ordem')::int, 1),
        COALESCE(v_passageiro->>'nome', '(sem nome)'),
        v_passageiro->>'cpf',
        nullif(v_passageiro->>'data_nascimento', '')::date
      )
      RETURNING id INTO v_passageiro_id;
      v_passageiros_ids := array_append(v_passageiros_ids, v_passageiro_id);
    END LOOP;
  END IF;

  -- Cobrança
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
        plataforma_link, taxa_adquirente, valor_liquido,
        data_inicio, data_primeiro_recebimento, fornecedor_destino, observacoes
      ) VALUES (
        v_cobranca_id,
        v_item->>'tipo',
        (v_item->>'valor_total')::numeric,
        COALESCE((v_item->>'num_parcelas')::int, 1),
        nullif(v_item->>'valor_parcela', '')::numeric,
        v_item->>'plataforma_link',
        nullif(v_item->>'taxa_adquirente', '')::numeric,
        nullif(v_item->>'valor_liquido', '')::numeric,
        nullif(v_item->>'data_inicio', '')::date,
        nullif(v_item->>'data_primeiro_recebimento', '')::date,
        v_item->>'fornecedor_destino',
        v_item->>'observacoes'
      );
    END LOOP;
  END IF;

  -- Auto-aprovação: dispara parcelas + audit log
  IF v_auto_aprovado THEN
    PERFORM gerar_parcelas_receber(v_venda_id);

    INSERT INTO audit_logs (
      usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois
    ) VALUES (
      v_uid, v_empresa_id, 'venda', v_venda_id, 'auto_aprovacao',
      jsonb_build_object('aprovado_por', v_uid, 'motivo', 'criação por usuário com permissão de aprovar')
    );
  ELSE
    -- Cria lembrete pra cada Admin/Gerente da empresa
    FOR v_destinatario IN
      SELECT DISTINCT u.id
      FROM usuarios u
      JOIN perfis_acesso p ON p.id = u.perfil_id
      JOIN usuarios_empresas ue ON ue.usuario_id = u.id
      WHERE p.nome IN ('Administrador', 'Gerente')
        AND u.ativo = true
        AND ue.empresa_id = v_empresa_id
        AND u.id <> v_uid
    LOOP
      INSERT INTO lembretes (
        tipo, referencia_tipo, referencia_id,
        destinatario_id, empresa_id,
        data_lembrete, mensagem, status
      ) VALUES (
        'venda_pendente_validacao', 'venda', v_venda_id,
        v_destinatario.id, v_empresa_id,
        CURRENT_DATE,
        'Nova venda aguardando aprovação.',
        'pendente'
      );
    END LOOP;
  END IF;

  RETURN v_venda_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION criar_venda_completa FROM anon, public;
GRANT EXECUTE ON FUNCTION criar_venda_completa TO authenticated, service_role;

-- ── editar_venda_completa ───────────────────────────────────────────────────
-- Adiciona pgto_primeira_parcela_extra ao INSERT em venda_produtos

CREATE OR REPLACE FUNCTION public.editar_venda_completa(
  p_venda_id uuid,
  p_payload  jsonb,
  p_aprovar  boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid            uuid    := auth.uid();
  v_venda          record;
  v_produtos       jsonb   := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_passageiros    jsonb   := COALESCE(p_payload->'passageiros', '[]'::jsonb);
  v_cobranca       jsonb   := p_payload->'cobranca';
  v_produto        jsonb;
  v_passageiro     jsonb;
  v_item           jsonb;
  v_tipo_produto   record;
  v_cobranca_id    uuid;
  v_perm_aprovar   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = '02000';
  END IF;

  -- Atualiza campos principais
  UPDATE vendas SET
    cliente_id           = COALESCE(nullif(p_payload->>'cliente_id', '')::uuid, cliente_id),
    data_venda           = COALESCE((p_payload->>'data_venda')::date, data_venda),
    pax                  = COALESCE((p_payload->>'pax')::int, pax),
    origem               = COALESCE(p_payload->>'origem', origem),
    observacoes          = p_payload->>'observacoes',
    indicacao_percentual = COALESCE(nullif(p_payload->>'indicacao_percentual', '')::numeric, indicacao_percentual),
    comissao_percentual  = COALESCE(nullif(p_payload->>'comissao_percentual', '')::numeric, comissao_percentual),
    usuario_id           = COALESCE(nullif(p_payload->>'usuario_id', '')::uuid, usuario_id)
  WHERE id = p_venda_id;

  -- Recria produtos
  DELETE FROM venda_produtos WHERE venda_id = p_venda_id;

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
      p_venda_id,
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
      (v_produto->>'valor_venda')::numeric,
      (v_produto->>'valor_custo')::numeric,
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
    );
  END LOOP;

  -- Passageiros
  DELETE FROM venda_passageiros WHERE venda_id = p_venda_id;
  IF jsonb_array_length(v_passageiros) = 0 THEN
    INSERT INTO venda_passageiros (venda_id, nome, ordem)
    VALUES (p_venda_id, '(sem nome)', 1);
  ELSE
    FOR v_passageiro IN SELECT * FROM jsonb_array_elements(v_passageiros)
    LOOP
      INSERT INTO venda_passageiros (
        venda_id, ordem, nome, cpf, data_nascimento
      ) VALUES (
        p_venda_id,
        COALESCE((v_passageiro->>'ordem')::int, 1),
        COALESCE(v_passageiro->>'nome', '(sem nome)'),
        v_passageiro->>'cpf',
        nullif(v_passageiro->>'data_nascimento', '')::date
      );
    END LOOP;
  END IF;

  -- Cobrança
  DELETE FROM cobranca_cliente WHERE venda_id = p_venda_id;
  IF v_cobranca IS NOT NULL THEN
    INSERT INTO cobranca_cliente (venda_id, valor_total, observacoes)
    VALUES (
      p_venda_id,
      (v_cobranca->>'valor_total')::numeric,
      v_cobranca->>'observacoes'
    )
    RETURNING id INTO v_cobranca_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_cobranca->'itens', '[]'::jsonb))
    LOOP
      INSERT INTO cobranca_cliente_itens (
        cobranca_id, tipo, valor_total, num_parcelas, valor_parcela,
        plataforma_link, taxa_adquirente, valor_liquido,
        data_inicio, data_primeiro_recebimento, fornecedor_destino, observacoes
      ) VALUES (
        v_cobranca_id,
        v_item->>'tipo',
        (v_item->>'valor_total')::numeric,
        COALESCE((v_item->>'num_parcelas')::int, 1),
        nullif(v_item->>'valor_parcela', '')::numeric,
        v_item->>'plataforma_link',
        nullif(v_item->>'taxa_adquirente', '')::numeric,
        nullif(v_item->>'valor_liquido', '')::numeric,
        nullif(v_item->>'data_inicio', '')::date,
        nullif(v_item->>'data_primeiro_recebimento', '')::date,
        v_item->>'fornecedor_destino',
        v_item->>'observacoes'
      );
    END LOOP;
  END IF;

  -- Aprovação opcional (Gerente / Admin)
  IF p_aprovar THEN
    SELECT permissoes->'vendas'->>'aprovar' INTO v_perm_aprovar
    FROM usuarios u JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = v_uid;
    IF v_perm_aprovar = 'true' THEN
      UPDATE vendas SET
        status = 'aprovado',
        aprovado_por = v_uid,
        data_aprovacao = now(),
        motivo_revisao = NULL
      WHERE id = p_venda_id;
      PERFORM gerar_parcelas_receber(p_venda_id);
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION editar_venda_completa FROM anon, public;
GRANT EXECUTE ON FUNCTION editar_venda_completa TO authenticated, service_role;
