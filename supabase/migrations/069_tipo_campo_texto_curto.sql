-- =============================================================================
-- 069 — Adiciona tipo de campo dinâmico 'texto_curto'
-- =============================================================================
-- Permite que o operador classifique campos de texto livre em duas
-- variantes:
--   'texto'        → texto longo (padrão; campo grande)
--   'texto_curto'  → texto curto (campo menor, ideal pra códigos, IDs,
--                    localizadores, identificadores etc).
--
-- A persistência é a mesma: ambos vão em `venda_produtos.valores_extras`
-- como string. A diferença é só semântica/UI (largura do input).
-- =============================================================================
ALTER TABLE campos_extra DROP CONSTRAINT IF EXISTS campos_extra_tipo_campo_check;
ALTER TABLE campos_extra ADD CONSTRAINT campos_extra_tipo_campo_check
  CHECK (tipo_campo IN (
    'texto', 'texto_curto', 'dropdown', 'data', 'numero', 'sim_nao', 'fornecedor'
  ));
