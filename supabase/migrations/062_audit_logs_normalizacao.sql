-- =============================================================================
-- 062 — audit_logs: normaliza entidade venda + ações aprovar/devolver
-- =============================================================================
-- As RPCs aprovar_venda e devolver_venda escreviam em audit_logs com entidade
-- `vendas` (plural) e ações `aprovado` / `devolvido_para_revisao`, enquanto
-- todas as outras escritas usam `venda` (singular) e verbos simples
-- (criar/editar/excluir). Isso polui filtros e relatórios.
--
-- Esta migration:
--   1. Reescreve aprovar_venda → entidade='venda', acao='aprovar'
--   2. Reescreve devolver_venda → entidade='venda', acao='devolver'
--   3. Faz backfill dos registros históricos (acao='aprovado' / 'devolvido…')
-- =============================================================================

-- ── 1. aprovar_venda ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aprovar_venda(p_venda_id uuid, p_aprovador_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_empresa_id UUID;
  v_agente_id UUID;
  v_identificador TEXT;
BEGIN
  SELECT status, empresa_id, usuario_id, identificador
    INTO v_status, v_empresa_id, v_agente_id, v_identificador
    FROM vendas WHERE id = p_venda_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;
  IF v_status <> 'pendente_validacao' THEN
    RAISE EXCEPTION 'Só é possível aprovar vendas em pendente_validacao (status atual: %).', v_status;
  END IF;

  UPDATE vendas
    SET status = 'aprovado', aprovado_por = p_aprovador_id, data_aprovacao = NOW()
    WHERE id = p_venda_id;

  -- entidade='venda' (singular) + acao='aprovar' — consistente com o resto
  INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_id, empresa_id, dados_depois)
  VALUES (
    'venda', p_venda_id, 'aprovar', p_aprovador_id, v_empresa_id,
    jsonb_build_object(
      'identificador',  v_identificador,
      'status_anterior','pendente_validacao',
      'status_novo',    'aprovado'
    )
  );

  IF v_agente_id IS NOT NULL AND v_agente_id <> p_aprovador_id THEN
    INSERT INTO lembretes (
      tipo, referencia_tipo, referencia_id,
      destinatario_id, empresa_id,
      data_lembrete, mensagem, status
    ) VALUES (
      'venda_aprovada', 'venda', p_venda_id,
      v_agente_id, v_empresa_id, CURRENT_DATE,
      'Sua venda ' || COALESCE(v_identificador, '') || ' foi aprovada.',
      'pendente'
    );
  END IF;

  PERFORM gerar_parcelas_receber(p_venda_id);
END;
$function$;

-- ── 2. devolver_venda ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.devolver_venda(p_venda_id uuid, p_revisor_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status      TEXT;
  v_empresa_id  UUID;
  v_agente_id   UUID;
  v_identificador TEXT;
BEGIN
  SELECT status, empresa_id, usuario_id, identificador
    INTO v_status, v_empresa_id, v_agente_id, v_identificador
    FROM vendas WHERE id = p_venda_id FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;
  IF v_status <> 'pendente_validacao' THEN
    RAISE EXCEPTION 'Só é possível devolver vendas em pendente_validacao (status atual: %).', v_status;
  END IF;

  UPDATE vendas
     SET status = 'em_revisao', motivo_revisao = p_motivo
   WHERE id = p_venda_id;

  -- entidade='venda' (singular) + acao='devolver' — consistente
  INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_id, empresa_id, dados_depois)
  VALUES (
    'venda', p_venda_id, 'devolver', p_revisor_id, v_empresa_id,
    jsonb_build_object(
      'identificador',  v_identificador,
      'motivo',         p_motivo,
      'status_anterior','pendente_validacao',
      'status_novo',    'em_revisao'
    )
  );

  IF v_agente_id IS NOT NULL AND v_agente_id <> p_revisor_id THEN
    INSERT INTO lembretes (
      tipo, referencia_tipo, referencia_id,
      destinatario_id, empresa_id,
      data_lembrete, mensagem, status
    ) VALUES (
      'venda_em_revisao', 'venda', p_venda_id,
      v_agente_id, v_empresa_id, CURRENT_DATE,
      'Sua venda ' || COALESCE(v_identificador, '') || ' precisa de revisão: ' || p_motivo,
      'pendente'
    );
  END IF;
END;
$function$;

-- ── 3. Backfill dos registros históricos ────────────────────────────────────
UPDATE audit_logs
   SET entidade = 'venda', acao = 'aprovar'
 WHERE entidade = 'vendas' AND acao = 'aprovado';

UPDATE audit_logs
   SET entidade = 'venda', acao = 'devolver'
 WHERE entidade = 'vendas' AND acao = 'devolvido_para_revisao';
