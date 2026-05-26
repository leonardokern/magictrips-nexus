-- RPC para atualizar/remover foto de perfil de um usuário.
-- SECURITY DEFINER: roda com privilégios do owner, bypassa RLS em usuarios.
-- A autorização real (can "editar") é verificada no Server Action antes de chamar.
CREATE OR REPLACE FUNCTION atualizar_foto_usuario(
  p_user_id  uuid,
  p_foto_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usuarios SET foto_url = p_foto_url WHERE id = p_user_id;
END;
$$;
