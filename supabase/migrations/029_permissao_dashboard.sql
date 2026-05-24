-- ============================================================================
-- Migration 029 — Permissão `dashboard.ver`
-- ============================================================================
-- Acrescenta o módulo `dashboard` com a ação `ver` ao catálogo de permissões.
-- Inicialmente Administrador (já tem por bypass) e Gerente recebem true.
-- Agentes ficam sem ver os cards de KPIs/finanças — assim o dashboard inicial
-- pode ser dedicado a métricas gerenciais sem expor dados a todo mundo.

UPDATE perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'dashboard',
  jsonb_build_object('ver', true)
)
WHERE nome IN ('Administrador', 'Gerente');

UPDATE perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'dashboard',
  jsonb_build_object('ver', false)
)
WHERE nome NOT IN ('Administrador', 'Gerente');
