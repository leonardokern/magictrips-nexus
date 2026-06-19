-- =============================================================================
-- 077 — Adiciona tipo de campo dinâmico 'valor'
-- =============================================================================
-- Permite que o operador marque um campo dinâmico como monetário (R$).
-- No formulário de venda o campo renderiza um input com prefixo "R$" e
-- formata automaticamente no blur via parseValorComSoma/formatBRL.
-- A persistência continua sendo string em venda_produtos.valores_extras.
-- =============================================================================
ALTER TABLE campos_extra DROP CONSTRAINT IF EXISTS campos_extra_tipo_campo_check;
ALTER TABLE campos_extra ADD CONSTRAINT campos_extra_tipo_campo_check
  CHECK (tipo_campo IN (
    'texto', 'texto_curto', 'dropdown', 'data', 'numero', 'valor', 'sim_nao', 'fornecedor'
  ));
