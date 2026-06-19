-- =============================================================================
-- 075 — Permissão de Relatórios
-- =============================================================================
-- Adiciona o módulo `relatorios` (ação única `ver`) ao JSONB de permissões.
-- Administrador tem bypass no app, mas setamos `true` na linha dele por
-- consistência com a grade do editor de perfis. Demais perfis começam em
-- `false` — liberação manual por perfil, como qualquer outro módulo.
-- =============================================================================

-- Admin → true (consistência visual; can() já dá bypass)
UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'::jsonb),
  '{relatorios}',
  '{"ver": true}'::jsonb,
  true
)
WHERE chave_sistema = 'admin';

-- Demais perfis → false (ainda não veem a menos que liberados)
UPDATE perfis_acesso
SET permissoes = jsonb_set(
  COALESCE(permissoes, '{}'::jsonb),
  '{relatorios}',
  '{"ver": false}'::jsonb,
  true
)
WHERE chave_sistema IS DISTINCT FROM 'admin'
  AND NOT (COALESCE(permissoes, '{}'::jsonb) ? 'relatorios');
