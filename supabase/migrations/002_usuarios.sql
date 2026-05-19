-- =============================================================================
-- 002 — Usuários
-- =============================================================================
-- Tabela usuarios espelha auth.users (id = auth.users.id).
-- empresa_id NULL = Administrador Master (vê todas as empresas).
-- comissao_percentual NULL = usa régua 30/40/50%. Preenchido = % fixo por user.
-- =============================================================================

CREATE TABLE usuarios (
  id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome                    text NOT NULL,
  email                   text NOT NULL UNIQUE,
  perfil_id               uuid NOT NULL REFERENCES perfis_acesso(id),
  empresa_id              uuid REFERENCES empresas(id),
  iniciais                text,
  comissao_percentual     numeric(5,2),
  force_password_change   boolean NOT NULL DEFAULT false,
  ativo                   boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Espelha auth.users com metadados de negócio (perfil, empresa, comissão)';
COMMENT ON COLUMN usuarios.empresa_id IS 'NULL = Administrador Master (acesso a todas as empresas)';
COMMENT ON COLUMN usuarios.comissao_percentual IS 'NULL = usa régua 30/40/50%. Preenchido = % fixo (ex: Jéssica/Del Mondo = 12.00)';
COMMENT ON COLUMN usuarios.iniciais IS 'Ex: MM para Marcelo Maciel — usado em códigos/descrições';

CREATE INDEX idx_usuarios_perfil ON usuarios(perfil_id);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX idx_usuarios_ativo ON usuarios(ativo) WHERE ativo = true;

-- Trigger para manter updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
