-- =============================================================================
-- 089 — Logo branca por padrão nos PDFs
-- =============================================================================
-- Magic Trips estava usando `magic-trips-logo-solo.png` (versão azul),
-- que ficava ilegível sobre o header colorido azul dos PDFs. Volta pra
-- variação branca (intenção original da migration 040). Del Mondo ganha
-- sua variação branca também (estava NULL).
-- =============================================================================

UPDATE empresas
   SET logo_path = 'brand/magic-trips-solo-white.png'
 WHERE slug = 'magic-trips';

UPDATE empresas
   SET logo_path = 'brand/del-mondo-white.png',
       cor_primaria = COALESCE(cor_primaria, '#004E5A')
 WHERE slug = 'del-mondo';
