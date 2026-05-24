-- =============================================================================
-- 032 — Conserta trigger enforce_empresa_matches_perfil
-- =============================================================================
-- A tabela `usuarios_empresas` tem PK composta `(usuario_id, empresa_id)` e
-- não tem coluna `id`. A função do trigger referenciava `NEW.id` no
-- `SELECT COUNT(*)`, falhando com "column 'id' does not exist" sempre que
-- alguém tentava criar/atualizar um vínculo com perfil scoped a empresa
-- específica (ex: Agente Magic Trips). Substitui por `empresa_id <> NEW.empresa_id`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_empresa_matches_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perfil_empresa uuid;
  v_qtd integer;
BEGIN
  SELECT p.empresa_id
  INTO v_perfil_empresa
  FROM usuarios u
  JOIN perfis_acesso p ON p.id = u.perfil_id
  WHERE u.id = NEW.usuario_id;

  IF v_perfil_empresa IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id <> v_perfil_empresa THEN
    RAISE EXCEPTION 'Este perfil atua apenas em uma empresa específica; selecione essa empresa.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*)
  INTO v_qtd
  FROM usuarios_empresas
  WHERE usuario_id = NEW.usuario_id
    AND (TG_OP = 'INSERT' OR empresa_id <> NEW.empresa_id);

  IF v_qtd >= 1 THEN
    RAISE EXCEPTION 'O perfil deste usuário permite vínculo com apenas uma empresa.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
