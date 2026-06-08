-- =============================================================================
-- 060 — RPCs de usuários abertas pro Gerente
-- =============================================================================
-- O perfil Gerente já tem `usuarios:{ler,criar,editar,excluir}` no JSONB e a
-- RLS de `usuarios`/`usuarios_empresas` foi liberada na migration 057. Mas
-- 3 RPCs SECURITY DEFINER ainda barravam Gerente via `is_administrador()`:
--
--   - criar_usuario_admin         (criação do auth.users + usuarios + N:N)
--   - atualizar_empresas_usuario  (replace de usuarios_empresas)
--   - resetar_senha_usuario       (UPDATE em auth.users)
--
-- Esta migration troca por `is_administrador() OR is_gerente()`. Defesa em
-- profundidade preservada: o Server Action continua checando
-- `can(user, "usuarios", "<acao>")` antes de chamar a RPC.
-- =============================================================================

-- ── criar_usuario_admin ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_usuario_admin(
  p_email text, p_senha text, p_nome text, p_perfil_id uuid,
  p_empresa_ids uuid[], p_iniciais text DEFAULT NULL::text,
  p_forcar_troca boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id        uuid := gen_random_uuid();
  v_empresa_id     uuid;
  v_perfil_empresa uuid;
BEGIN
  IF NOT (is_administrador() OR is_gerente()) THEN
    RAISE EXCEPTION 'Sem permissão para criar usuários.' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_email, '')) < 3 THEN
    RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_senha, '')) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 8 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_empresa_ids IS NULL OR array_length(p_empresa_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos uma empresa.' USING ERRCODE = '22023';
  END IF;

  SELECT empresa_id INTO v_perfil_empresa FROM perfis_acesso WHERE id = p_perfil_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil inválido.' USING ERRCODE = '23503';
  END IF;
  IF v_perfil_empresa IS NOT NULL THEN
    IF array_length(p_empresa_ids, 1) <> 1 OR p_empresa_ids[1] <> v_perfil_empresa THEN
      RAISE EXCEPTION 'Este perfil atua apenas em uma empresa específica.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF EXISTS (
    SELECT unnest(p_empresa_ids) AS eid
    EXCEPT
    SELECT id FROM empresas WHERE ativo = true
  ) THEN
    RAISE EXCEPTION 'Uma ou mais empresas selecionadas são inválidas.' USING ERRCODE = '23503';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'Já existe um usuário com este e-mail.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id,
    'authenticated', 'authenticated',
    lower(p_email),
    extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome, 'iniciais', p_iniciais),
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now()
  );

  INSERT INTO usuarios (
    id, nome, email, perfil_id, iniciais, ativo, force_password_change
  ) VALUES (
    v_user_id, p_nome, lower(p_email), p_perfil_id, p_iniciais, true, p_forcar_troca
  );

  FOREACH v_empresa_id IN ARRAY p_empresa_ids LOOP
    INSERT INTO usuarios_empresas (usuario_id, empresa_id)
    VALUES (v_user_id, v_empresa_id);
  END LOOP;

  INSERT INTO audit_logs (
    usuario_id, empresa_id, acao, entidade, entidade_id, dados_depois
  ) VALUES (
    auth.uid(), p_empresa_ids[1], 'criar', 'usuario', v_user_id,
    jsonb_build_object(
      'nome', p_nome, 'email', lower(p_email),
      'perfil_id', p_perfil_id, 'empresa_ids', p_empresa_ids,
      'forcar_troca', p_forcar_troca
    )
  );

  RETURN v_user_id;
END;
$function$;

-- ── atualizar_empresas_usuario ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_empresas_usuario(
  p_user_id uuid, p_empresa_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id     uuid;
  v_perfil_empresa uuid;
BEGIN
  IF NOT (is_administrador() OR is_gerente()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar empresas de um usuário.'
      USING ERRCODE = '42501';
  END IF;
  IF p_empresa_ids IS NULL OR array_length(p_empresa_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos uma empresa.' USING ERRCODE = '22023';
  END IF;

  SELECT p.empresa_id
  INTO v_perfil_empresa
  FROM usuarios u
  JOIN perfis_acesso p ON p.id = u.perfil_id
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário inválido.' USING ERRCODE = '23503';
  END IF;

  IF v_perfil_empresa IS NOT NULL THEN
    IF array_length(p_empresa_ids, 1) <> 1 OR p_empresa_ids[1] <> v_perfil_empresa THEN
      RAISE EXCEPTION 'Este perfil atua apenas em uma empresa específica.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF EXISTS (
    SELECT unnest(p_empresa_ids) AS eid
    EXCEPT
    SELECT id FROM empresas WHERE ativo = true
  ) THEN
    RAISE EXCEPTION 'Uma ou mais empresas selecionadas são inválidas.' USING ERRCODE = '23503';
  END IF;

  DELETE FROM usuarios_empresas WHERE usuario_id = p_user_id;

  FOREACH v_empresa_id IN ARRAY p_empresa_ids LOOP
    INSERT INTO usuarios_empresas (usuario_id, empresa_id)
    VALUES (p_user_id, v_empresa_id);
  END LOOP;
END;
$function$;

-- ── resetar_senha_usuario ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resetar_senha_usuario(
  p_user_id uuid, p_nova_senha text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_administrador() OR is_gerente()) THEN
    RAISE EXCEPTION 'Sem permissão para resetar senhas.' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_nova_senha, '')) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 8 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '23503';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE usuarios
  SET force_password_change = true, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_logs (
    usuario_id, empresa_id, acao, entidade, entidade_id, motivo
  ) VALUES (
    auth.uid(), NULL, 'resetar_senha', 'usuario', p_user_id, 'Reset via UI'
  );
END;
$function$;
