-- Expande o CHECK constraint de tipo_campo para incluir 'sim_nao' e 'fornecedor'.
-- 'sim_nao' já existia no catálogo do frontend mas não no banco.
-- 'fornecedor' é o novo tipo que renderiza um select dos fornecedores cadastrados.
ALTER TABLE campos_extra DROP CONSTRAINT IF EXISTS campos_extra_tipo_campo_check;
ALTER TABLE campos_extra
  ADD CONSTRAINT campos_extra_tipo_campo_check
  CHECK (tipo_campo IN ('texto', 'dropdown', 'data', 'numero', 'sim_nao', 'fornecedor'));
