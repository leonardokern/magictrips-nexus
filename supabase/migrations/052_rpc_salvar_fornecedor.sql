-- RPC para salvar (criar ou atualizar) fornecedor e seus vínculos de tipo de produto.
-- SECURITY DEFINER: bypassa RLS em fornecedores e fornecedor_tipos_produto.
-- A autorização real (can "criar"/"editar") é verificada no Server Action.

CREATE OR REPLACE FUNCTION criar_fornecedor(
  p_nome                          text,
  p_cnpj                          text,
  p_tipo                          text DEFAULT NULL,
  p_modo_comissionado             boolean DEFAULT false,
  p_modo_comissionado_dia         smallint DEFAULT NULL,
  p_modo_net                      boolean DEFAULT false,
  p_tipos_produto_ids             uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO fornecedores (nome, cnpj, tipo, ativo, modo_comissionado, modo_comissionado_dia_pagamento, modo_net)
  VALUES (p_nome, p_cnpj, p_tipo, true, p_modo_comissionado, p_modo_comissionado_dia, p_modo_net)
  RETURNING id INTO v_id;

  -- Vínculos de tipo de produto
  IF array_length(p_tipos_produto_ids, 1) > 0 THEN
    INSERT INTO fornecedor_tipos_produto (fornecedor_id, tipo_produto_id)
    SELECT v_id, unnest(p_tipos_produto_ids);
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION atualizar_fornecedor(
  p_id                            uuid,
  p_nome                          text,
  p_cnpj                          text,
  p_tipo                          text DEFAULT NULL,
  p_modo_comissionado             boolean DEFAULT false,
  p_modo_comissionado_dia         smallint DEFAULT NULL,
  p_modo_net                      boolean DEFAULT false,
  p_tipos_produto_ids             uuid[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE fornecedores
  SET
    nome                          = p_nome,
    cnpj                          = p_cnpj,
    tipo                          = p_tipo,
    modo_comissionado             = p_modo_comissionado,
    modo_comissionado_dia_pagamento = p_modo_comissionado_dia,
    modo_net                      = p_modo_net
  WHERE id = p_id;

  -- Substitui vínculos de tipo de produto (delete + insert)
  DELETE FROM fornecedor_tipos_produto WHERE fornecedor_id = p_id;
  IF array_length(p_tipos_produto_ids, 1) > 0 THEN
    INSERT INTO fornecedor_tipos_produto (fornecedor_id, tipo_produto_id)
    SELECT p_id, unnest(p_tipos_produto_ids);
  END IF;
END;
$$;
