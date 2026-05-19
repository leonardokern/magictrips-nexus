-- =============================================================================
-- 001 — Empresas e Perfis de Acesso
-- =============================================================================
-- Cria as duas marcas operadas (Magic Trips e Del Mondo) e os 3 perfis fixos
-- do sistema (Administrador, Gerente, Agente). Perfis fixos têm sistema=true
-- e não podem ser deletados/renomeados.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- empresas
-- ---------------------------------------------------------------------------
CREATE TABLE empresas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  cnpj        text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE empresas IS 'Marcas operadas pelo sistema. Slug: magic-trips | del-mondo';

-- ---------------------------------------------------------------------------
-- perfis_acesso
-- ---------------------------------------------------------------------------
CREATE TABLE perfis_acesso (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  sistema     boolean NOT NULL DEFAULT false,
  permissoes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE perfis_acesso IS 'Perfis RBAC. sistema=true → fixos (Administrador/Gerente/Agente), não deletáveis';
COMMENT ON COLUMN perfis_acesso.permissoes IS
  'JSONB: {"modulo": {"acao": bool}}. Ex: {"vendas":{"ler":true,"criar":true,"aprovar":false}}';

-- Bloqueia DELETE em perfis fixos via trigger
CREATE OR REPLACE FUNCTION proteger_perfis_sistema()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sistema = true THEN
    RAISE EXCEPTION 'Perfis fixos do sistema não podem ser deletados (nome=%, id=%)', OLD.nome, OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_proteger_perfis_sistema_delete
  BEFORE DELETE ON perfis_acesso
  FOR EACH ROW
  EXECUTE FUNCTION proteger_perfis_sistema();

-- Bloqueia rename de perfis fixos via trigger
CREATE OR REPLACE FUNCTION proteger_rename_perfis_sistema()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sistema = true AND NEW.nome <> OLD.nome THEN
    RAISE EXCEPTION 'Perfis fixos do sistema não podem ser renomeados (nome=%)', OLD.nome;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_perfis_sistema_update
  BEFORE UPDATE ON perfis_acesso
  FOR EACH ROW
  EXECUTE FUNCTION proteger_rename_perfis_sistema();

-- ---------------------------------------------------------------------------
-- Seed — empresas
-- ---------------------------------------------------------------------------
INSERT INTO empresas (nome, slug) VALUES
  ('Magic Trips', 'magic-trips'),
  ('Del Mondo',   'del-mondo');

-- ---------------------------------------------------------------------------
-- Seed — perfis fixos
-- ---------------------------------------------------------------------------
-- Administrador: permissões completas (único perfil totalmente seeded).
-- Gerente e Agente: permissões vazias — preenchidas incrementalmente conforme
-- cada módulo é construído (estratégia do roadmap V1.0).

INSERT INTO perfis_acesso (nome, sistema, permissoes) VALUES
  (
    'Administrador',
    true,
    jsonb_build_object(
      'clientes',     jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'vendas',       jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true, 'aprovar', true),
      'financeiro',   jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'cartoes',      jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'fornecedores', jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'tipos_produto', jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'usuarios',     jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'perfis',       jsonb_build_object('ler', true, 'criar', true, 'editar', true, 'excluir', true),
      'auditoria',    jsonb_build_object('ler', true),
      'exportar',     jsonb_build_object('csv', true, 'excel', true)
    )
  ),
  ('Gerente', true, '{}'::jsonb),
  ('Agente',  true, '{}'::jsonb);
