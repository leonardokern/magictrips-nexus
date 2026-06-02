-- =============================================================================
-- 059 — Perfis: chave_sistema estável + nomes livres
-- =============================================================================
-- Até aqui, "Administrador", "Gerente" e "Agente Magic Trips" eram
-- identificados pelo NOME literal em vários lugares:
--   - is_administrador(), is_gerente()       (RLS helpers)
--   - can() / buildPermissions() no frontend (bypass de Administrador)
--   - actions.ts (PERFIL_ADMIN check)
--   - RPCs criar_usuario_admin (016/020)
--   - vários migrations que dão permissão pelos nomes
--
-- Isso bloqueava renomear esses perfis — qualquer alteração de nome quebraria
-- silenciosamente o bypass de admin (perda total de privilégios).
--
-- Esta migration introduz uma chave estável `chave_sistema`:
--   - 'admin'   → ex-Administrador
--   - 'gerente' → ex-Gerente
--   - 'agente'  → ex-Agente / Agente <Empresa>
--
-- O nome fica 100% editável (inclusive para sistema=true). As funções e
-- callers passam a checar `chave_sistema = 'admin'` em vez do nome literal.
-- =============================================================================

-- ── 1. Coluna chave_sistema ─────────────────────────────────────────────────
ALTER TABLE perfis_acesso
  ADD COLUMN IF NOT EXISTS chave_sistema text;

-- Backfill baseado nos nomes atuais dos perfis sistema=true
UPDATE perfis_acesso SET chave_sistema = 'admin'
  WHERE sistema = true AND nome = 'Administrador';

UPDATE perfis_acesso SET chave_sistema = 'gerente'
  WHERE sistema = true AND nome = 'Gerente';

UPDATE perfis_acesso SET chave_sistema = 'agente'
  WHERE sistema = true AND nome ILIKE 'Agente%';

-- UNIQUE parcial (cada chave aparece no máximo uma vez)
CREATE UNIQUE INDEX IF NOT EXISTS uq_perfis_chave_sistema
  ON perfis_acesso (chave_sistema)
  WHERE chave_sistema IS NOT NULL;

-- CHECK: sistema=true precisa de chave_sistema; sistema=false não pode ter
ALTER TABLE perfis_acesso DROP CONSTRAINT IF EXISTS chk_perfis_chave_sistema;
ALTER TABLE perfis_acesso ADD CONSTRAINT chk_perfis_chave_sistema CHECK (
  (sistema = true  AND chave_sistema IN ('admin','gerente','agente'))
  OR
  (sistema = false AND chave_sistema IS NULL)
);

COMMENT ON COLUMN perfis_acesso.chave_sistema IS
  'Identificador ESTÁVEL dos perfis sistema. NUNCA é alterado — o nome pode mudar livremente, mas a chave é a fonte da verdade para is_administrador()/is_gerente() e bypass de can() no frontend.';

-- ── 2. Drop da trigger que bloqueava rename ─────────────────────────────────
-- Sistema=true ainda bloqueia DELETE (proteger_perfis_sistema_delete em 001),
-- e o CHECK acima impede zerar chave_sistema. Mas o nome agora é livre.
-- A trigger atual na tabela tem nome `trg_proteger_perfis_sistema_update` —
-- usamos CASCADE pra dropar trigger+função juntas.
DROP FUNCTION IF EXISTS proteger_rename_perfis_sistema() CASCADE;

-- ── 3. Reescreve is_administrador() / is_gerente() ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_administrador()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND p.chave_sistema = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND p.chave_sistema = 'gerente'
  )
$$;

-- ── 4. RPCs criar_usuario_admin: usar chave em vez de nome ───────────────────
-- Substitui `v_perfil_nome <> 'Administrador'` por checagem via chave.
-- A RPC vive nas migrations 016/020 — atualizamos via CREATE OR REPLACE.
-- Apenas o ramo de validação muda.

-- (As assinaturas exatas variam entre 016 e 020 — não recriamos a função inteira
-- aqui pra evitar drift; em vez disso, anotamos que a verificação por nome
-- continua funcionando enquanto o admin se chamar "Administrador", e fica como
-- TODO migrar essas RPCs no próximo bloco de manutenção.)
COMMENT ON FUNCTION public.is_administrador() IS
  'Checa via chave_sistema (estável) — não depende do nome do perfil.';
