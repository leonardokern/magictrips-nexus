-- =============================================================================
-- 081 — criar_alteracao_venda: tratar cobranca jsonb-null como ausente
-- =============================================================================
-- O cliente envia `cobranca: null` quando a alteração não muda cobrança. Em
-- jsonb isso vira `'null'::jsonb` (não SQL NULL), então a guarda
-- `IF v_cobranca IS NOT NULL` passava e tentava inserir cobranca_cliente com
-- valor_total NULL — quebrando a NOT NULL constraint.
--
-- Esta migration apenas ajusta a guarda dentro do bloco da cobrança usando
-- jsonb_typeof. Não toca em mais nada da RPC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.criar_alteracao_venda(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_original_id    uuid := (p_payload->>'venda_original_id')::uuid;
  v_observacoes    text := p_payload->>'observacoes';
  v_produtos       jsonb := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_cobranca       jsonb := p_payload->'cobranca';
  v_original       record;
  v_venda_id       uuid;
  v_cobranca_id    uuid;
  v_produto        jsonb;
  v_produto_id     uuid;
  v_item           jsonb;
  v_tipo_produto   record;
  v_perm_criar     text;
  v_user_empresas  uuid[];
  v_num_venda      integer;
  v_prefixo        text;
  v_identificador  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT permissoes->'vendas'->>'criar' INTO v_perm_criar
  FROM usuarios u JOIN perfis_acesso p ON p.id = u.perfil_id
  WHERE u.id = v_uid;
  IF v_perm_criar IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Sem permissão para criar alterações.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_original FROM vendas WHERE id = v_original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda original não encontrada.' USING ERRCODE = '02000';
  END IF;
  IF v_original.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Apenas vendas aprovadas podem ter alterações.' USING ERRCODE = '22023';
  END IF;
  IF v_original.tipo_venda <> 'original' THEN
    RAISE EXCEPTION 'Alteração só pode ser feita sobre uma venda original.' USING ERRCODE = '22023';
  END IF;

  v_user_empresas := app_user_empresas();
  IF NOT (v_original.empresa_id = ANY(v_user_empresas)) THEN
    RAISE EXCEPTION 'Empresa fora do escopo do usuário.' USING ERRCODE = '42501';
  END IF;

  SELECT CASE slug
    WHEN 'magic-trips' THEN 'MT'
    WHEN 'del-mondo'   THEN 'DM'
    ELSE upper(left(slug, 2))
  END INTO v_prefixo
  FROM empresas WHERE id = v_original.empresa_id;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(identificador, '^[A-Z]+-', ''), '')::int), 0) + 1
    INTO v_num_venda
  FROM vendas
  WHERE empresa_id = v_original.empresa_id AND identificador ~ '^[A-Z]+-\d+$';

  v_identificador := v_prefixo || '-' || lpad(v_num_venda::text, 4, '0');

  INSERT INTO vendas (
    empresa_id, usuario_id, cliente_id, identificador, data_venda, pax, origem,
    observacoes, status, indicacao_percentual, comissao_percentual,
    aprovado_por, data_aprovacao,
    tipo_venda, venda_original_id
  ) VALUES (
    v_original.empresa_id, v_uid, v_original.cliente_id, v_identificador,
    CURRENT_DATE, v_original.pax, v_original.origem,
    v_observacoes, 'pendente_validacao', v_original.indicacao_percentual,
    v_original.comissao_percentual, NULL, NULL,
    'alteracao_valores', v_original_id
  )
  RETURNING id INTO v_venda_id;

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

  INSERT INTO venda_passageiros (venda_id, ordem, nome, cpf, data_nascimento, passaporte)
  SELECT v_venda_id, ordem, nome, cpf, data_nascimento, passaporte
  FROM venda_passageiros WHERE venda_id = v_original_id;

  -- Cobrança opcional. Trata jsonb-null como ausente: o cliente envia
  -- `cobranca: null` quando a alteração não toca em cobrança.
  IF v_cobranca IS NOT NULL AND jsonb_typeof(v_cobranca) = 'object' THEN
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

  INSERT INTO audit_logs (
    usuario_id, empresa_id, entidade, entidade_id, acao, dados_depois
  ) VALUES (
    v_uid, v_original.empresa_id, 'venda', v_venda_id, 'criar',
    jsonb_build_object(
      'identificador',     v_identificador,
      'tipo_venda',        'alteracao_valores',
      'venda_original_id', v_original_id,
      'observacoes',       v_observacoes
    )
  );

  RETURN v_venda_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION criar_alteracao_venda(jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION criar_alteracao_venda(jsonb) TO authenticated, service_role;
