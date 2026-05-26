-- =============================================================================
-- 048 — Geração de parcelas a receber + PIX parcelável
-- =============================================================================
-- Quando a venda é aprovada, para cada item de cobrança em PIX ou Boleto
-- (formas em que o cliente paga DIRETO À MAGIC, em parcelas a partir de uma
-- data conhecida), criamos N linhas em `parcelas_receber` para alimentar
-- futuramente o módulo de Contas a Receber e os lembretes 3 dias antes de
-- cada vencimento.
--
-- Tipos cobertos: 'pix', 'boleto'
-- Tipo NÃO coberto: 'cartao_credito' (cliente pagou via link/cartão na hora,
-- a Magic recebe da adquirente conforme cronograma próprio — V2 trata isso)
-- Tipo NÃO coberto: 'outro' (cliente paga direto ao fornecedor / fora da Magic)
--
-- Idempotência: a função faz DELETE de parcelas existentes da venda antes
-- de inserir, então pode ser chamada quantas vezes precisar (re-aprovação,
-- editar e aprovar de novo, etc).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gerar_parcelas_receber(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id    uuid;
  v_cliente_id    uuid;
  v_data_venda    date;
  v_item          record;
  v_parcela_num   int;
  v_valor_parcela numeric(12,2);
  v_data_venc     date;
BEGIN
  SELECT empresa_id, cliente_id, data_venda
    INTO v_empresa_id, v_cliente_id, v_data_venda
    FROM vendas WHERE id = p_venda_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Venda % não encontrada.', p_venda_id;
  END IF;

  -- Limpa parcelas existentes desta venda (idempotência)
  DELETE FROM parcelas_receber WHERE venda_id = p_venda_id;

  -- Itera itens de cobrança que viram parcelas a receber
  FOR v_item IN
    SELECT cci.id, cci.tipo, cci.valor_total, cci.num_parcelas,
           cci.valor_parcela, cci.data_primeiro_recebimento
      FROM cobranca_cliente cc
      JOIN cobranca_cliente_itens cci ON cci.cobranca_id = cc.id
     WHERE cc.venda_id = p_venda_id
       AND cci.tipo IN ('pix', 'boleto')
  LOOP
    -- Sem data_primeiro_recebimento não dá pra agendar nada — pula
    IF v_item.data_primeiro_recebimento IS NULL THEN
      CONTINUE;
    END IF;

    -- Valor por parcela: usa valor_parcela informado ou divide o total
    v_valor_parcela :=
      COALESCE(
        v_item.valor_parcela,
        ROUND(v_item.valor_total / GREATEST(v_item.num_parcelas, 1), 2)
      );

    -- Gera N parcelas, mesmo dia todo mês a partir da data_primeiro_recebimento
    FOR v_parcela_num IN 1 .. GREATEST(v_item.num_parcelas, 1) LOOP
      v_data_venc := v_item.data_primeiro_recebimento + ((v_parcela_num - 1) || ' months')::interval;

      INSERT INTO parcelas_receber (
        empresa_id, venda_id, cobranca_item_id, cliente_id,
        numero, total_parcelas,
        descricao, valor, forma_pagamento,
        data_emissao, data_vencimento, status
      ) VALUES (
        v_empresa_id, p_venda_id, v_item.id, v_cliente_id,
        v_parcela_num, GREATEST(v_item.num_parcelas, 1),
        'Cobrança ' || v_item.tipo || ' — parcela ' || v_parcela_num || '/' || GREATEST(v_item.num_parcelas, 1),
        v_valor_parcela,
        v_item.tipo,
        v_data_venda,
        v_data_venc,
        'pendente'
      );
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_parcelas_receber(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_parcelas_receber(uuid) TO authenticated;
