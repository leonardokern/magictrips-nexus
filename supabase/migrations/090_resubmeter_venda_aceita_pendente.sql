-- ============================================================================
-- 090 — Resubmeter aceita pendente_validacao + delega ao editar_venda_completa
-- ============================================================================
-- Antes: só era possível resubmeter venda devolvida (em_revisao). Agora o
-- agente pode também corrigir uma venda em pendente_validacao (antes do
-- gerente revisar) sem precisar pedir devolução.
--
-- Mudanças:
--   1. RPC resubmeter_venda agora aceita rascunho/em_revisao/pendente_validacao.
--      Delega corpo pro editar_venda_completa (canônico, atualizado com todos
--      os campos novos: rav_comissionado, taxa_cobranca, plataforma,
--      parcelas_detalhe, comprovante, passaporte, etc.) — antes a função
--      tinha cópia local desatualizada.
--   2. RLS de vendas + tabelas filho (cobranca_cliente, venda_produtos,
--      venda_passageiros, venda_anexos) passam a aceitar pendente_validacao
--      no escopo do agente dono.
-- ============================================================================

-- ── 1. RLS vendas ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vendas_update ON public.vendas;
CREATE POLICY vendas_update ON public.vendas FOR UPDATE USING (
  mesma_empresa(empresa_id) AND (
    is_administrador()
    OR is_gerente()
    OR (usuario_id = auth.uid() AND status IN ('rascunho', 'em_revisao', 'pendente_validacao'))
  )
);

-- ── 2. RLS tabelas filho ──────────────────────────────────────────────────
DROP POLICY IF EXISTS venda_produtos_write ON public.venda_produtos;
CREATE POLICY venda_produtos_write ON public.venda_produtos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_produtos.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao', 'pendente_validacao')))
  )
);

DROP POLICY IF EXISTS venda_passageiros_write ON public.venda_passageiros;
CREATE POLICY venda_passageiros_write ON public.venda_passageiros FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_passageiros.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao', 'pendente_validacao')))
  )
);

DROP POLICY IF EXISTS cobranca_write ON public.cobranca_cliente;
CREATE POLICY cobranca_write ON public.cobranca_cliente FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = cobranca_cliente.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao', 'pendente_validacao')))
  )
);

DROP POLICY IF EXISTS venda_anexos_delete ON public.venda_anexos;
CREATE POLICY venda_anexos_delete ON public.venda_anexos FOR DELETE USING (
  ((wizard_session_id IS NOT NULL) AND (created_by = auth.uid()))
  OR ((venda_id IS NOT NULL) AND EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_anexos.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente()
           OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho', 'em_revisao', 'pendente_validacao')))
  ))
);

-- ── 3. resubmeter_venda — delega ao editar_venda_completa ──────────────────
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
  v_uid             uuid := auth.uid();
  v_owner_id        uuid;
  v_status          text;
  v_empresa_id      uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT usuario_id, status, empresa_id
    INTO v_owner_id, v_status, v_empresa_id
    FROM vendas
   WHERE id = p_venda_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = '02000';
  END IF;

  IF v_owner_id <> v_uid THEN
    RAISE EXCEPTION 'Você não é o dono desta venda.' USING ERRCODE = '42501';
  END IF;

  -- Só bloqueia se já aprovada ou cancelada (estados finais).
  IF v_status NOT IN ('rascunho', 'em_revisao', 'pendente_validacao') THEN
    RAISE EXCEPTION 'Não é possível editar venda com status %.', v_status
      USING ERRCODE = '23514';
  END IF;

  -- Delega o write pro RPC canônico (cobre todos os campos novos).
  PERFORM public.editar_venda_completa(p_venda_id, p_payload, false);

  -- Após edição, sempre vai pra pendente_validacao e limpa motivo_revisao.
  UPDATE vendas
     SET status         = 'pendente_validacao',
         motivo_revisao = NULL
   WHERE id = p_venda_id;

  -- Audit
  INSERT INTO audit_logs (usuario_id, empresa_id, acao, entidade, entidade_id, dados_depois)
  VALUES (
    v_uid, v_empresa_id, 'resubmetido', 'venda', p_venda_id,
    jsonb_build_object(
      'status_anterior', v_status,
      'status_novo',     'pendente_validacao'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resubmeter_venda(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resubmeter_venda(uuid, jsonb) TO authenticated;
