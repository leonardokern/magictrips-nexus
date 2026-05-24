-- =============================================================================
-- 043 — Status "em_revisao"
-- =============================================================================
-- Substitui a devolução direto para rascunho por um novo status intermediário
-- "em_revisao". O agente vê claramente que precisa corrigir a venda e reenviar.
-- =============================================================================

-- ── 1. Adiciona 'em_revisao' ao CHECK de status ───────────────────────────────
ALTER TABLE vendas DROP CONSTRAINT vendas_status_check;
ALTER TABLE vendas ADD CONSTRAINT vendas_status_check
  CHECK (status IN ('rascunho', 'em_revisao', 'pendente_validacao', 'aprovado', 'cancelado'));

-- ── 2. Atualiza devolver_venda: rascunho → em_revisao ────────────────────────
CREATE OR REPLACE FUNCTION public.devolver_venda(
  p_venda_id   uuid,
  p_revisor_id uuid,
  p_motivo     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status     TEXT;
  v_empresa_id UUID;
BEGIN
  SELECT status, empresa_id
    INTO v_status, v_empresa_id
    FROM vendas
   WHERE id = p_venda_id
     FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  IF v_status <> 'pendente_validacao' THEN
    RAISE EXCEPTION 'Só é possível devolver vendas em pendente_validacao (status atual: %).', v_status;
  END IF;

  UPDATE vendas
     SET status         = 'em_revisao',
         motivo_revisao = p_motivo
   WHERE id = p_venda_id;

  INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_id, empresa_id, dados_depois)
  VALUES (
    'vendas',
    p_venda_id,
    'devolvido_para_revisao',
    p_revisor_id,
    v_empresa_id,
    jsonb_build_object(
      'motivo',          p_motivo,
      'status_anterior', 'pendente_validacao',
      'status_novo',     'em_revisao'
    )
  );
END;
$$;

-- ── 3. Atualiza RLS de vendas: agente pode editar rascunho ou em_revisao ──────
DROP POLICY IF EXISTS vendas_update ON public.vendas;
CREATE POLICY vendas_update ON public.vendas FOR UPDATE USING (
  mesma_empresa(empresa_id) AND (
    is_administrador() OR
    is_gerente() OR
    (usuario_id = auth.uid() AND status IN ('rascunho', 'em_revisao'))
  )
);

-- ── 4. Atualiza RLS das tabelas filho para incluir em_revisao ─────────────────
DROP POLICY IF EXISTS venda_produtos_write ON public.venda_produtos;
CREATE POLICY venda_produtos_write ON public.venda_produtos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_produtos.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao')))
  )
);

DROP POLICY IF EXISTS venda_passageiros_write ON public.venda_passageiros;
CREATE POLICY venda_passageiros_write ON public.venda_passageiros FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_passageiros.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao')))
  )
);

DROP POLICY IF EXISTS cobranca_write ON public.cobranca_cliente;
CREATE POLICY cobranca_write ON public.cobranca_cliente FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = cobranca_cliente.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao')))
  )
);

-- ── 5. Cria resubmeter_venda: agente corrige e resubmete ─────────────────────
CREATE OR REPLACE FUNCTION public.resubmeter_venda(
  p_venda_id uuid,
  p_payload  jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid            uuid    := auth.uid();
  v_owner_id       uuid;
  v_empresa_id     uuid;
  v_status         text;

  -- Campos do payload
  v_data_venda     date    := nullif(p_payload->>'data_venda', '')::date;
  v_pax            int     := COALESCE(nullif(p_payload->>'pax', '')::int, 1);
  v_origem         text    := p_payload->>'origem';
  v_indicacao      numeric := nullif(p_payload->>'indicacao_percentual', '')::numeric;
  v_comissao_perc  numeric := nullif(p_payload->>'comissao_percentual', '')::numeric;
  v_observacoes    text    := p_payload->>'observacoes';

  v_produtos       jsonb   := COALESCE(p_payload->'produtos', '[]'::jsonb);
  v_passageiros    jsonb   := COALESCE(p_payload->'passageiros', '[]'::jsonb);
  v_cobranca       jsonb   := p_payload->'cobranca';

  v_cobranca_id    uuid;
  v_produto        jsonb;
  v_produto_id     uuid;
  v_passageiro     jsonb;
  v_passageiro_id  uuid;
  v_item           jsonb;
  v_tipo_produto   record;
  v_passageiros_ids uuid[] := ARRAY[]::uuid[];
  v_cliente_id     uuid;
BEGIN
  -- ── Autenticação ────────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  -- ── Lê a venda e verifica propriedade + status ──────────────────────────────
  SELECT usuario_id, empresa_id, status, cliente_id
    INTO v_owner_id, v_empresa_id, v_status, v_cliente_id
    FROM vendas
   WHERE id = p_venda_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = '02000';
  END IF;

  IF v_owner_id <> v_uid THEN
    RAISE EXCEPTION 'Você não é o dono desta venda.' USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'em_revisao' THEN
    RAISE EXCEPTION 'Só é possível resubmeter vendas com status em_revisao (atual: %).', v_status
      USING ERRCODE = '23514';
  END IF;

  -- ── Atualiza campos da venda ─────────────────────────────────────────────────
  UPDATE vendas SET
    data_venda           = COALESCE(v_data_venda, data_venda),
    pax                  = v_pax,
    origem               = v_origem,
    indicacao_percentual = v_indicacao,
    comissao_percentual  = v_comissao_perc,
    observacoes          = v_observacoes,
    status               = 'pendente_validacao',
    motivo_revisao       = NULL
  WHERE id = p_venda_id;

  -- ── Recria produtos ──────────────────────────────────────────────────────────
  DELETE FROM venda_produtos WHERE venda_id = p_venda_id;

  FOR v_produto IN SELECT * FROM jsonb_array_elements(v_produtos)
  LOOP
    SELECT id, nome INTO v_tipo_produto
    FROM tipos_produto
    WHERE id = (v_produto->>'tipo_produto_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tipo de produto inválido.' USING ERRCODE = '23503';
    END IF;

    INSERT INTO venda_produtos (
      venda_id, ordem,
      tipo_produto_id, tipo_produto_nome,
      fornecedor_id, fornecedor_nome,
      localizador, localizador_fornecedor, destino,
      data_inicio_viagem, data_fim_viagem,
      valores_extras, tipo_comissao,
      valor_venda, valor_custo,
      rav, rav_extra_cliente, rav_extra_fornecedor,
      comissao_vendedor,
      pgto_forma, pgto_cartao_id, pgto_valor_total,
      pgto_entrada, pgto_num_parcelas, pgto_valor_parcela,
      pgto_data_debito
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
      v_produto->>'pgto_forma',
      nullif(v_produto->>'pgto_cartao_id', '')::uuid,
      nullif(v_produto->>'pgto_valor_total', '')::numeric,
      COALESCE((v_produto->>'pgto_entrada')::numeric, 0),
      COALESCE((v_produto->>'pgto_num_parcelas')::int, 1),
      nullif(v_produto->>'pgto_valor_parcela', '')::numeric,
      nullif(v_produto->>'pgto_data_debito', '')::date
    )
    RETURNING id INTO v_produto_id;
  END LOOP;

  -- ── Recria passageiros ───────────────────────────────────────────────────────
  DELETE FROM venda_passageiros WHERE venda_id = p_venda_id;

  IF jsonb_array_length(v_passageiros) = 0 THEN
    INSERT INTO venda_passageiros (venda_id, nome, ordem)
    SELECT p_venda_id, c.nome, 1
    FROM clientes c WHERE c.id = v_cliente_id
    RETURNING id INTO v_passageiro_id;
    v_passageiros_ids := array_append(v_passageiros_ids, v_passageiro_id);
  ELSE
    FOR v_passageiro IN SELECT * FROM jsonb_array_elements(v_passageiros)
    LOOP
      INSERT INTO venda_passageiros (
        venda_id, nome, cpf, data_nascimento, ordem
      ) VALUES (
        p_venda_id,
        v_passageiro->>'nome',
        v_passageiro->>'cpf',
        nullif(v_passageiro->>'data_nascimento', '')::date,
        COALESCE((v_passageiro->>'ordem')::int, 1)
      )
      RETURNING id INTO v_passageiro_id;
      v_passageiros_ids := array_append(v_passageiros_ids, v_passageiro_id);
    END LOOP;
  END IF;

  -- Recria vínculos produto-passageiro
  INSERT INTO venda_produto_passageiros (venda_produto_id, venda_passageiro_id)
  SELECT vp.id, unnest(v_passageiros_ids)
  FROM venda_produtos vp
  WHERE vp.venda_id = p_venda_id;

  -- ── Recria cobrança ──────────────────────────────────────────────────────────
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

  -- ── Auditoria ────────────────────────────────────────────────────────────────
  INSERT INTO audit_logs (usuario_id, empresa_id, acao, entidade, entidade_id, dados_depois)
  VALUES (
    v_uid, v_empresa_id, 'resubmetido', 'venda', p_venda_id,
    jsonb_build_object(
      'status_anterior', 'em_revisao',
      'status_novo',     'pendente_validacao'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resubmeter_venda(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resubmeter_venda(uuid, jsonb) TO authenticated;
