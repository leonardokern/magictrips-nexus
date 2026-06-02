-- =============================================================================
-- 056 — Anexos da venda (até 10 por venda, 10 MB cada, PDF + imagens)
-- =============================================================================
-- O wizard cria/edita vendas e, entre os steps de Passageiros e Revisão,
-- aceita uploads de comprovantes/voucher do fornecedor, prints da reserva, etc.
--
-- Para vendas em edição o `venda_id` é conhecido desde o início do upload.
-- Para vendas novas o `venda_id` só existe após a RPC `criar_venda_completa`
-- ser executada; por isso usamos um agrupador temporário `wizard_session_id`
-- (UUID gerado no client) — os anexos uploadados ficam associados a esse
-- session_id até a venda ser criada, quando a própria RPC migra
-- `venda_anexos.wizard_session_id → venda_id`.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bucket de storage `venda-anexos` (privado — acesso via signed URL)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'venda-anexos',
  'venda-anexos',
  false,                 -- privado — sempre via signed URL
  10485760,              -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: o controle de quem pode ler/escrever é feito via
-- signed URL pelo servidor (server action usa service_role pra gerar URL
-- e a permissão de gerar/listar/deletar é validada no banco via RLS de
-- `venda_anexos`). Aqui basta liberar para `authenticated` operar sobre
-- objetos do bucket — a tabela `venda_anexos` faz o gate fino.

CREATE POLICY "venda_anexos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'venda-anexos');

CREATE POLICY "venda_anexos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'venda-anexos');

CREATE POLICY "venda_anexos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'venda-anexos');

CREATE POLICY "venda_anexos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'venda-anexos');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela `venda_anexos`
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS venda_anexos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Quando vinculado a uma venda existente. Para uploads pré-criação,
   *  fica NULL até a RPC `criar_venda_completa` migrar via session_id. */
  venda_id            uuid        REFERENCES vendas(id) ON DELETE CASCADE,
  /** Agrupador temporário usado durante o wizard de NOVA venda. Quando a
   *  venda é criada, a RPC seta venda_id e zera wizard_session_id. */
  wizard_session_id   uuid,
  storage_path        text        NOT NULL UNIQUE,
  nome_arquivo        text        NOT NULL,
  mime_type           text        NOT NULL,
  tamanho_bytes       int         NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Pelo menos um dos dois sempre preenchido
  CHECK (venda_id IS NOT NULL OR wizard_session_id IS NOT NULL),

  -- Mime types permitidos — espelha o bucket
  CHECK (mime_type IN (
    'image/jpeg','image/jpg','image/png','image/webp','image/gif','application/pdf'
  ))
);

COMMENT ON TABLE  venda_anexos IS 'Anexos (PDF/imagens) das vendas. Até 10 por venda, 10 MB cada. Antes da venda existir, ficam grupados por wizard_session_id.';
COMMENT ON COLUMN venda_anexos.wizard_session_id IS 'Agrupador temporário durante o wizard de nova venda; setado para NULL ao migrar para venda_id.';

CREATE INDEX idx_venda_anexos_venda
  ON venda_anexos(venda_id)
  WHERE venda_id IS NOT NULL;

CREATE INDEX idx_venda_anexos_session
  ON venda_anexos(wizard_session_id, created_by)
  WHERE wizard_session_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE venda_anexos ENABLE ROW LEVEL SECURITY;

-- SELECT: pode ler se for dono da sessão pendente ou se enxerga a venda
CREATE POLICY venda_anexos_select ON venda_anexos
  FOR SELECT TO authenticated
  USING (
    (wizard_session_id IS NOT NULL AND created_by = auth.uid())
    OR (
      venda_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM vendas v
        WHERE v.id = venda_anexos.venda_id
          AND mesma_empresa(v.empresa_id)
          AND (
            is_administrador()
            OR is_gerente()
            OR v.usuario_id = auth.uid()
          )
      )
    )
  );

-- INSERT: criar_by sempre é o próprio usuário, e:
--   - upload com session_id: livre (será validado o limite pelo server)
--   - upload com venda_id: só se o usuário pode editar essa venda
CREATE POLICY venda_anexos_insert ON venda_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      wizard_session_id IS NOT NULL
      OR (
        venda_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM vendas v
          WHERE v.id = venda_anexos.venda_id
            AND mesma_empresa(v.empresa_id)
            AND (
              is_administrador()
              OR is_gerente()
              OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho','em_revisao'))
            )
        )
      )
    )
  );

-- UPDATE: usado pela RPC `criar_venda_completa` (via SECURITY DEFINER) e
-- também pelo dono pra eventual ajustes — restringimos a quem criou.
CREATE POLICY venda_anexos_update ON venda_anexos
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: dono da sessão pendente; ou quem pode editar a venda
CREATE POLICY venda_anexos_delete ON venda_anexos
  FOR DELETE TO authenticated
  USING (
    (wizard_session_id IS NOT NULL AND created_by = auth.uid())
    OR (
      venda_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM vendas v
        WHERE v.id = venda_anexos.venda_id
          AND mesma_empresa(v.empresa_id)
          AND (
            is_administrador()
            OR is_gerente()
            OR (v.usuario_id = auth.uid() AND v.status IN ('rascunho','em_revisao'))
          )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: enforce limite de 10 anexos por venda
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_venda_anexos_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.venda_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM venda_anexos
    WHERE venda_id = NEW.venda_id;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Limite de 10 anexos por venda atingido.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.wizard_session_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM venda_anexos
    WHERE wizard_session_id = NEW.wizard_session_id
      AND created_by = NEW.created_by;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Limite de 10 anexos por venda atingido.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_venda_anexos_limit() FROM anon, authenticated;

CREATE TRIGGER trg_venda_anexos_limit
  BEFORE INSERT ON venda_anexos
  FOR EACH ROW EXECUTE FUNCTION enforce_venda_anexos_limit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Atualiza CHECK do step do rascunho — agora vai de 1 a 6
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vendas_rascunho
  DROP CONSTRAINT IF EXISTS vendas_rascunho_step_check;

ALTER TABLE vendas_rascunho
  ADD CONSTRAINT vendas_rascunho_step_check
  CHECK (step BETWEEN 1 AND 6);
