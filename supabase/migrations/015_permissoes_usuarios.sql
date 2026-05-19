-- =============================================================================
-- 015 — Permissão de leitura de usuarios para o Gerente
-- =============================================================================
-- Estado inicial: Gerente pode VER usuários (RLS já filtra pela própria empresa).
-- Criação/edição/exclusão continua restrita ao Administrador.
-- Agente fica sem qualquer permissão sobre usuários.
--
-- Lembre-se: as permissões podem ser modificadas posteriormente em /perfis.
-- =============================================================================

UPDATE perfis_acesso
SET permissoes = jsonb_set(
  permissoes,
  '{usuarios}',
  jsonb_build_object(
    'ler', true,
    'criar', false,
    'editar', false,
    'excluir', false
  ),
  true
)
WHERE nome = 'Gerente';
