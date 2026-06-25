-- 088 — RPC get_usuarios_ultima_interacao
--
-- Substitui o "Último login" da lista de usuários por "Última interação" =
-- a coisa mais recente que o usuário fez no sistema. Combina dois sinais:
--   1. MAX(audit_logs.created_at) — qualquer mutação rastreada (criar/editar/aprovar/etc).
--   2. auth.users.last_sign_in_at — o próprio login conta como interação,
--      e capta usuários que entram mas não chegam a mutar nada.
-- O retornado é o maior dos dois (GREATEST com COALESCE pra tolerar nulls).
--
-- Mesma forma de `get_usuarios_ultimo_login` (mig 045-ish): SECURITY DEFINER
-- pra acessar auth.users sem exigir RLS no caller. Apenas leitura.

CREATE OR REPLACE FUNCTION public.get_usuarios_ultima_interacao(p_user_ids uuid[])
RETURNS TABLE(usuario_id uuid, ultima_interacao timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    u.id,
    GREATEST(
      COALESCE(a.last_sign_in_at, 'epoch'::timestamptz),
      COALESCE(l.ultimo_log,      'epoch'::timestamptz)
    ) AS ultima_interacao
  FROM unnest(p_user_ids) AS u(id)
  LEFT JOIN auth.users a ON a.id = u.id
  LEFT JOIN LATERAL (
    SELECT MAX(created_at) AS ultimo_log
    FROM audit_logs
    WHERE audit_logs.usuario_id = u.id
  ) l ON true
$$;

-- Permissões: mesma postura do get_usuarios_ultimo_login.
REVOKE ALL ON FUNCTION public.get_usuarios_ultima_interacao(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_usuarios_ultima_interacao(uuid[]) TO authenticated;
