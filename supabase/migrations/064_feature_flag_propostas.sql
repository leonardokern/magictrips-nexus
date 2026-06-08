-- ─── Feature flag: propostas ─────────────────────────────────────────────────
-- Habilitada em dev/preview, desabilitada em prod por padrão.
-- Admin pode alterar via /feature-flags no painel.

INSERT INTO feature_flags (chave, descricao, ativo_dev, ativo_prod)
VALUES (
  'propostas',
  'Módulo de propostas comerciais com geração de PDF executivo.',
  true,   -- habilitado em dev/local/preview
  false   -- desabilitado em produção até release oficial
)
ON CONFLICT (chave) DO UPDATE SET
  descricao  = EXCLUDED.descricao,
  ativo_dev  = EXCLUDED.ativo_dev;
  -- ativo_prod NÃO sobrescrito em conflict — preserva decisão do admin em prod.
