-- RPC: get_usuario_completo
-- Retorna todos os dados necessários para montar CurrentUser em uma única
-- roundtrip ao banco, eliminando o waterfall:
--   usuarios → Promise.all(perfis_acesso, usuarios_empresas, empresas_count)
--
-- Chamada por getCurrentUser() em lib/hooks/use-current-user.ts.
-- SECURITY DEFINER: executa como owner da função (bypass de RLS controlado).
-- O p_user_id é sempre o auth.uid() validado pelo caller — não expõe dados
-- de terceiros porque a query filtra explicitamente por p_user_id.

CREATE OR REPLACE FUNCTION get_usuario_completo(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_usuario   record;
  v_perfil    record;
  v_empresas  jsonb;
  v_total     integer;
BEGIN
  -- 1. Usuário
  SELECT id, nome, email, iniciais, foto_url, ativo, force_password_change, perfil_id
  INTO v_usuario
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 2. Perfil
  SELECT id, nome, sistema, permissoes, tipo, chave_sistema
  INTO v_perfil
  FROM perfis_acesso
  WHERE id = v_usuario.perfil_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 3. Empresas do usuário (join, ordenadas por nome)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', e.id, 'nome', e.nome, 'slug', e.slug)
      ORDER BY e.nome
    ),
    '[]'::jsonb
  )
  INTO v_empresas
  FROM usuarios_empresas ue
  JOIN empresas e ON e.id = ue.empresa_id
  WHERE ue.usuario_id = p_user_id;

  -- 4. Total de empresas ativas
  SELECT COUNT(*) INTO v_total
  FROM empresas
  WHERE ativo = true;

  RETURN jsonb_build_object(
    'id',                    v_usuario.id,
    'nome',                  v_usuario.nome,
    'email',                 v_usuario.email,
    'iniciais',              v_usuario.iniciais,
    'foto_url',              v_usuario.foto_url,
    'ativo',                 v_usuario.ativo,
    'force_password_change', v_usuario.force_password_change,
    'perfil', jsonb_build_object(
      'id',           v_perfil.id,
      'nome',         v_perfil.nome,
      'sistema',      v_perfil.sistema,
      'permissoes',   v_perfil.permissoes,
      'tipo',         v_perfil.tipo,
      'chave_sistema',v_perfil.chave_sistema
    ),
    'empresas',        v_empresas,
    'total_empresas',  v_total
  );
END;
$$;

-- Permite que usuários autenticados chamem a função
GRANT EXECUTE ON FUNCTION get_usuario_completo(uuid) TO authenticated;
