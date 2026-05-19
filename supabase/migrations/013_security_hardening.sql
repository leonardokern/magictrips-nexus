-- =============================================================================
-- 013 — Security Hardening (advisor warnings)
-- =============================================================================
-- Corrige avisos do database linter do Supabase:
--   1. SET search_path em todas as funções (evita injection via search_path)
--   2. Move pg_trgm para schema 'extensions' (boa prática)
--   3. Restringe policy INSERT de fornecedores (auth.uid() obrigatório)
--   4. Restringe policy INSERT de integration_logs (só service_role)
--   5. Revoga EXECUTE de anon nas helper functions SECURITY DEFINER
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SET search_path nas funções existentes
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_flag_marketing()
  SET search_path = public;

ALTER FUNCTION public.proteger_perfis_sistema()
  SET search_path = public;

ALTER FUNCTION public.proteger_rename_perfis_sistema()
  SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Mover pg_trgm para schema 'extensions'
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Garante que extensions está no search_path para que os índices funcionem
ALTER DATABASE postgres SET search_path TO "$user", public, extensions;

-- ---------------------------------------------------------------------------
-- 3. Restringe fornecedores_insert — exige autenticação
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fornecedores_insert_qualquer ON fornecedores;

CREATE POLICY fornecedores_insert_autenticado ON fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. Restringe integration_logs_insert — só service_role
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS integration_logs_insert ON integration_logs;

-- Sem policy de INSERT para authenticated → bloqueado.
-- service_role bypassa RLS por padrão (escrita via edge functions).

-- ---------------------------------------------------------------------------
-- 5. Revoga EXECUTE de anon nas helper functions SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- Mantém EXECUTE para authenticated (necessário para RLS policies funcionarem)
-- e service_role (edge functions).
REVOKE EXECUTE ON FUNCTION public.app_user_perfil_nome()    FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.app_user_empresa_id()     FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_administrador()        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_gerente()              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_agente()               FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mesma_empresa(uuid)       FROM anon, public;

GRANT EXECUTE ON FUNCTION public.app_user_perfil_nome()    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_user_empresa_id()     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_administrador()        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_gerente()              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_agente()               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mesma_empresa(uuid)       TO authenticated, service_role;
