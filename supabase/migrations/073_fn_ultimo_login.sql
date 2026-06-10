-- Expõe auth.users.last_sign_in_at para o schema público.
-- Necessário porque auth.users não é acessível diretamente por RLS/anon.
-- Retorna apenas as colunas necessárias para a listagem de usuários.
CREATE OR REPLACE FUNCTION public.get_usuarios_ultimo_login(p_user_ids uuid[])
RETURNS TABLE(usuario_id uuid, ultimo_login timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id, last_sign_in_at
  FROM auth.users
  WHERE id = ANY(p_user_ids)
$$;
