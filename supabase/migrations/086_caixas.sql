-- Caixas financeiras da agência (contas bancárias, carteiras etc.)
CREATE TABLE IF NOT EXISTS caixas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID REFERENCES empresas(id),
  nome        TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caixas_empresa" ON caixas
  FOR ALL USING (empresa_id IS NULL OR mesma_empresa(empresa_id));

-- Seed inicial para Magic Trips
INSERT INTO caixas (nome, empresa_id)
SELECT unnest(ARRAY['BANCO INTER','INTER CDB','BANCO DO BRASIL','WISE']), id
FROM empresas WHERE slug = 'magic-trips';
