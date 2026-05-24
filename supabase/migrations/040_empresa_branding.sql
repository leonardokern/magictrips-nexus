-- =============================================================================
-- 040 — Branding por empresa (cores e logo)
-- =============================================================================
-- Adiciona cor_primaria, cor_secundaria e logo_path em empresas para uso em
-- documentos PDF e futuros layouts dinâmicos de marca.
-- =============================================================================

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS cor_primaria   TEXT,
  ADD COLUMN IF NOT EXISTS cor_secundaria TEXT,
  ADD COLUMN IF NOT EXISTS logo_path      TEXT;

-- Magic Trips
UPDATE empresas
SET cor_primaria = '#1498D5',
    logo_path    = 'brand/magic-trips-white.png'
WHERE slug = 'magic-trips';

-- Del Mondo — deixado em branco por ora
