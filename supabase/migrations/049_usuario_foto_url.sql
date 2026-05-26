-- Adiciona coluna de foto de perfil aos usuários
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url text;

-- Cria bucket de storage para avatares (público — URLs acessíveis sem auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS do bucket
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
