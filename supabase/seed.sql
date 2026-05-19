-- =============================================================================
-- seed.sql — Dados iniciais do Compass
-- =============================================================================
-- Aplicado uma única vez após as migrations. NÃO é uma migration (não vai em
-- supabase/migrations/) porque envolve criação de usuário em auth.users com
-- senha — sensível e irrepetível em produção.
--
-- Idempotente: o INSERT só roda se o usuário ainda não existir.
-- =============================================================================

-- Administrador Master (Marcelo)
-- Email: admin@magictrips.com.br
-- Senha provisória: adminmagic (TROCAR APÓS PRIMEIRO LOGIN EM PRODUÇÃO)
-- Hash: bcrypt 10 rounds via pgcrypto crypt() + gen_salt('bf', 10)
-- Mesmo algoritmo usado internamente pelo Supabase Auth signUp.

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_perfil_id uuid;
BEGIN
  -- Skip se já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@magictrips.com.br') THEN
    RAISE NOTICE 'Usuário admin@magictrips.com.br já existe — seed ignorado';
    RETURN;
  END IF;

  SELECT id INTO v_perfil_id FROM perfis_acesso WHERE nome = 'Administrador';

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
    'admin@magictrips.com.br',
    crypt('adminmagic', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nome":"Marcelo","iniciais":"MM"}'::jsonb,
    now(), now(),
    '', '', '', ''
  );

  -- 2. auth.identities (login email/senha)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', 'admin@magictrips.com.br',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now()
  );

  -- 3. public.usuarios (espelho com metadados de negócio)
  -- empresa_id NULL = Administrador Master (vê todas as empresas)
  INSERT INTO usuarios (
    id, nome, email, perfil_id, empresa_id, iniciais, ativo, force_password_change
  ) VALUES (
    v_user_id, 'Marcelo', 'admin@magictrips.com.br', v_perfil_id, NULL, 'MM', true, false
  );

  RAISE NOTICE 'Administrador criado: %', v_user_id;
END $$;
