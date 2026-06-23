-- Código sequencial da empresa para numeração de faturas.
-- Ex.: '01' → INV-2026-010001
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS codigo_fatura TEXT;
UPDATE empresas SET codigo_fatura = '01' WHERE slug = 'magic-trips';
