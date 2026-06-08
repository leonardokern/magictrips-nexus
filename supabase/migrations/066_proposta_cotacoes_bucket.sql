-- =============================================================================
-- 066 — Storage bucket para cotações de fornecedores
-- =============================================================================
-- Bucket privado onde os PDFs enviados pelos agentes ficam armazenados
-- antes de serem processados pelo Claude.
-- Separado do bucket venda-anexos para facilitar políticas de retenção futura.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proposta-cotacoes',
  'proposta-cotacoes',
  false,                         -- privado: acesso apenas por signed URL
  20971520,                      -- 20 MB por arquivo
  ARRAY['application/pdf', 'text/html', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ── Políticas de acesso ao bucket ─────────────────────────────────────────────
-- Apenas usuários autenticados podem operar. Não há acesso público.

-- Upload: qualquer usuário autenticado pode enviar
CREATE POLICY "proposta_cotacoes_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposta-cotacoes');

-- Leitura: qualquer usuário autenticado pode gerar signed URLs
CREATE POLICY "proposta_cotacoes_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proposta-cotacoes');

-- Deleção: qualquer usuário autenticado pode remover
-- (futuramente: restringir ao dono ou ao serviço)
CREATE POLICY "proposta_cotacoes_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proposta-cotacoes');
