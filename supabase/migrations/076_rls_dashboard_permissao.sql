-- =============================================================================
-- 076 — RLS: perfis com `dashboard.ver` enxergam vendas para o dashboard
-- =============================================================================
-- Contexto: hoje a permissão `dashboard.ver` é apenas gate de UI no Server
-- Component. Perfis tipo "operação" e "marketing" (não-Gerente, não-Admin) que
-- recebem essa permissão veem a página do dashboard, mas todos os KPIs/gráficos
-- aparecem zerados porque a RLS de `vendas`/`venda_produtos` só permite SELECT
-- para Administrador, Gerente, ou o próprio agente dono da venda
-- (migration 012, policies `vendas_select` + `venda_produtos_select`).
--
-- Esta migration:
--   1. Adiciona helper `tem_permissao_dashboard()` SECURITY DEFINER STABLE que
--      lê o JSONB `permissoes->'dashboard'->>'ver'` do perfil do usuário.
--   2. Estende as policies de SELECT de `vendas` e `venda_produtos` para
--      incluir esse caminho, mantendo o isolamento por empresa.
--
-- Escopo intencionalmente restrito: só as 2 tabelas que o
-- `/dashboard/page.tsx` consulta. As demais (venda_passageiros,
-- cobranca_cliente, etc.) continuam fechadas — perfis sem `vendas.ler` não
-- navegam até `/vendas` (gate em `can()` no Server Component) nem precisam do
-- conteúdo dessas tabelas pro dashboard.
--
-- Defesa em profundidade preservada: a página `/dashboard` continua checando
-- `can(user, "dashboard", "ver")` antes de qualquer query.
-- =============================================================================

CREATE OR REPLACE FUNCTION tem_permissao_dashboard()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND COALESCE(p.permissoes->'dashboard'->>'ver', 'false') = 'true'
  )
$$;

COMMENT ON FUNCTION tem_permissao_dashboard IS
  'True se o perfil do usuário autenticado tem permissoes.dashboard.ver = true. Usado em RLS de vendas/venda_produtos para destravar o dashboard de gestão para perfis operação/marketing.';

-- ── vendas_select ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vendas_select ON vendas;
CREATE POLICY vendas_select ON vendas
  FOR SELECT TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (
      is_administrador()
      OR is_gerente()
      OR tem_permissao_dashboard()
      OR usuario_id = auth.uid()
    )
  );

-- ── venda_produtos_select ───────────────────────────────────────────────────
DROP POLICY IF EXISTS venda_produtos_select ON venda_produtos;
CREATE POLICY venda_produtos_select ON venda_produtos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_produtos.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (
        is_administrador()
        OR is_gerente()
        OR tem_permissao_dashboard()
        OR v.usuario_id = auth.uid()
      )
  ));
