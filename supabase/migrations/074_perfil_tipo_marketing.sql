-- =============================================================================
-- 074 — Tipo de perfil 'marketing'
-- =============================================================================
-- Adiciona 'marketing' como terceiro tipo de perfil.
-- Comportamento idêntico ao 'operacao' (cross-empresa, sem comissão própria).
-- Atualiza os dois CHECK constraints de perfis_acesso e seta o perfil
-- existente "Marketing" para tipo='marketing'.
-- =============================================================================

-- 1. Expande o CHECK de valores válidos
ALTER TABLE perfis_acesso
DROP CONSTRAINT IF EXISTS perfis_acesso_tipo_check;

ALTER TABLE perfis_acesso
ADD CONSTRAINT perfis_acesso_tipo_check
  CHECK (tipo IN ('operacao', 'agente', 'marketing'));

-- 2. Expande o CHECK de escopo (marketing = cross-empresa, empresa_id NULL)
ALTER TABLE perfis_acesso
DROP CONSTRAINT IF EXISTS perfis_acesso_tipo_escopo_check;

ALTER TABLE perfis_acesso
ADD CONSTRAINT perfis_acesso_tipo_escopo_check CHECK (
  (tipo = 'agente'    AND empresa_id IS NOT NULL)
  OR (tipo = 'operacao'  AND empresa_id IS NULL)
  OR (tipo = 'marketing' AND empresa_id IS NULL)
);

-- 3. Atualiza o perfil existente "Marketing" para usar o novo tipo
UPDATE perfis_acesso
SET tipo = 'marketing'
WHERE nome = 'Marketing'
  AND sistema = false;
