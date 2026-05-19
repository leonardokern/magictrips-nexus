-- =============================================================================
-- 016 — RPCs SECURITY DEFINER para gestão de usuários
-- =============================================================================
-- O cliente PostgREST do Next.js usa publishable key (anon/authenticated) e
-- não pode escrever em auth.users. Estas RPCs delegam essas operações sob
-- restrições explícitas (checagem de perfil dentro da função).
--
-- Padrão:
--   - Funções marcadas SECURITY DEFINER + SET search_path = public
--   - EXECUTE revogado de anon/public; concedido a authenticated + service_role
--   - Checagem interna: somente Administrador pode criar/resetar/excluir
--   - alterar_minha_senha: qualquer usuário autenticado pode trocar a PRÓPRIA senha
-- =============================================================================

-- ---------------------------------------------------------------------------
-- criar_usuario_admin
-- ---------------------------------------------------------------------------
-- Cria usuário em auth.users + auth.identities + public.usuarios em uma
-- única transação. Retorna o user_id criado.
--
-- A senha é passada plain-text (será hashada com bcrypt aqui dentro). O
-- caller (Server Action) gera a senha e mostra ao admin pra cópia manual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION criar_usuario_admin(
  p_email             text,
  p_senha             text,
  p_nome              text,
  p_perfil_id         uuid,
  p_empresa_id        uuid,
  p_iniciais          text DEFAULT NULL,
  p_comissao_percentual numeric(5,2) DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := gen_random_uuid();
  v_perfil_nome text;
BEGIN
  -- Somente Administrador
  IF NOT is_administrador() THEN
    RAISE EXCEPTION 'Apenas o Administrador pode criar usuários.'
      USING ERRCODE = '42501';
  END IF;

  -- Validações
  IF length(coalesce(p_email, '')) < 3 THEN
    RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_senha, '')) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 8 caracteres.' USING ERRCODE = '22023';
  END IF;

  -- O perfil deve existir
  SELECT nome INTO v_perfil_nome FROM perfis_acesso WHERE id = p_perfil_id;
  IF v_perfil_nome IS NULL THEN
    RAISE EXCEPTION 'Perfil inválido.' USING ERRCODE = '23503';
  END IF;

  -- Administrador permite empresa NULL (acesso a todas).
  -- Demais perfis exigem uma empresa.
  IF v_perfil_nome <> 'Administrador' AND p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuários com perfil % devem ter uma empresa.', v_perfil_nome
      USING ERRCODE = '23502';
  END IF;

  -- Email único em auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'Já existe um usuário com este e-mail.' USING ERRCODE = '23505';
  END IF;

  -- 1. auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(p_senha, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome, 'iniciais', p_iniciais),
    now(), now(),
    '', '', '', ''
  );

  -- 2. auth.identities
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now()
  );

  -- 3. public.usuarios — force_password_change=true para forçar troca no 1º login
  INSERT INTO usuarios (
    id, nome, email, perfil_id, empresa_id, iniciais,
    comissao_percentual, ativo, force_password_change
  ) VALUES (
    v_user_id, p_nome, lower(p_email), p_perfil_id, p_empresa_id, p_iniciais,
    p_comissao_percentual, true, true
  );

  -- Audit
  INSERT INTO audit_logs (
    usuario_id, empresa_id, acao, entidade, entidade_id, dados_depois
  ) VALUES (
    auth.uid(), p_empresa_id, 'criar', 'usuario', v_user_id,
    jsonb_build_object(
      'nome', p_nome, 'email', lower(p_email),
      'perfil_id', p_perfil_id, 'empresa_id', p_empresa_id
    )
  );

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION criar_usuario_admin FROM anon, public;
GRANT EXECUTE ON FUNCTION criar_usuario_admin TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- resetar_senha_usuario
-- ---------------------------------------------------------------------------
-- Admin reseta a senha de outro usuário. Marca force_password_change=true.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resetar_senha_usuario(
  p_user_id uuid,
  p_nova_senha text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes_force boolean;
BEGIN
  IF NOT is_administrador() THEN
    RAISE EXCEPTION 'Apenas o Administrador pode resetar senhas.'
      USING ERRCODE = '42501';
  END IF;

  IF length(coalesce(p_nova_senha, '')) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 8 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '23503';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE usuarios
  SET force_password_change = true,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING force_password_change INTO v_antes_force;

  -- Audit
  INSERT INTO audit_logs (
    usuario_id, empresa_id, acao, entidade, entidade_id, motivo
  ) VALUES (
    auth.uid(),
    (SELECT empresa_id FROM usuarios WHERE id = p_user_id),
    'resetar_senha', 'usuario', p_user_id, 'Reset via UI admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION resetar_senha_usuario FROM anon, public;
GRANT EXECUTE ON FUNCTION resetar_senha_usuario TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- alterar_minha_senha
-- ---------------------------------------------------------------------------
-- Qualquer usuário autenticado pode trocar a PRÓPRIA senha. Verifica a senha
-- atual antes de trocar. Limpa force_password_change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION alterar_minha_senha(
  p_senha_atual text,
  p_nova_senha  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF length(coalesce(p_nova_senha, '')) < 8 THEN
    RAISE EXCEPTION 'Nova senha deve ter pelo menos 8 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_senha_atual = p_nova_senha THEN
    RAISE EXCEPTION 'A nova senha deve ser diferente da atual.' USING ERRCODE = '22023';
  END IF;

  SELECT encrypted_password INTO v_hash FROM auth.users WHERE id = v_uid;
  IF v_hash IS NULL OR v_hash <> crypt(p_senha_atual, v_hash) THEN
    RAISE EXCEPTION 'Senha atual incorreta.' USING ERRCODE = '28P01';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = v_uid;

  UPDATE usuarios
  SET force_password_change = false,
      updated_at = now()
  WHERE id = v_uid;

  -- Audit
  INSERT INTO audit_logs (
    usuario_id, empresa_id, acao, entidade, entidade_id
  ) VALUES (
    v_uid,
    (SELECT empresa_id FROM usuarios WHERE id = v_uid),
    'alterar_senha', 'usuario', v_uid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION alterar_minha_senha FROM anon, public;
GRANT EXECUTE ON FUNCTION alterar_minha_senha TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- excluir_usuario_admin
-- ---------------------------------------------------------------------------
-- Admin exclui um usuário. CASCADE em usuarios já remove o vínculo (FK em
-- auth.users com ON DELETE CASCADE).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION excluir_usuario_admin(
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dados jsonb;
  v_empresa uuid;
BEGIN
  IF NOT is_administrador() THEN
    RAISE EXCEPTION 'Apenas o Administrador pode excluir usuários.'
      USING ERRCODE = '42501';
  END IF;

  -- Não permite excluir a si mesmo
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário.'
      USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(u.*), u.empresa_id INTO v_dados, v_empresa
  FROM usuarios u WHERE u.id = p_user_id;

  IF v_dados IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '23503';
  END IF;

  -- Bloqueia exclusão se há vendas associadas (preserva integridade)
  IF EXISTS (SELECT 1 FROM vendas WHERE usuario_id = p_user_id) THEN
    RAISE EXCEPTION 'Este usuário possui vendas registradas. Inative-o em vez disso.'
      USING ERRCODE = '23P01';
  END IF;

  -- Audit ANTES do delete (FK cascade vai remover de usuarios)
  INSERT INTO audit_logs (
    usuario_id, empresa_id, acao, entidade, entidade_id, dados_antes
  ) VALUES (
    auth.uid(), v_empresa, 'excluir', 'usuario', p_user_id, v_dados
  );

  -- Delete em auth.users → cascade pra public.usuarios
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION excluir_usuario_admin FROM anon, public;
GRANT EXECUTE ON FUNCTION excluir_usuario_admin TO authenticated, service_role;
