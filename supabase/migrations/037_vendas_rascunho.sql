-- Rascunhos do wizard de nova venda
-- Salva o estado completo do wizard (JSONB) para o agente continuar depois.

CREATE TABLE IF NOT EXISTS vendas_rascunho (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  uuid        REFERENCES empresas(id),
  titulo      text        NOT NULL DEFAULT 'Rascunho',
  step        int         NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 5),
  dados       jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendas_rascunho ENABLE ROW LEVEL SECURITY;

-- Cada usuário gerencia apenas os próprios rascunhos
CREATE POLICY "rascunho_own_select" ON vendas_rascunho
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "rascunho_own_insert" ON vendas_rascunho
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "rascunho_own_update" ON vendas_rascunho
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "rascunho_own_delete" ON vendas_rascunho
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

-- Auto-atualiza updated_at
CREATE OR REPLACE FUNCTION update_vendas_rascunho_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rascunho_updated_at
  BEFORE UPDATE ON vendas_rascunho
  FOR EACH ROW EXECUTE FUNCTION update_vendas_rascunho_updated_at();
