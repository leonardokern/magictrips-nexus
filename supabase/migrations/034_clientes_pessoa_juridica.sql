-- =============================================================================
-- 034 — Clientes Pessoa Jurídica
-- =============================================================================
-- Adiciona suporte a cliente PJ:
--   * tipo_pessoa text ('fisica' | 'juridica'), default 'fisica'
--   * cnpj, razao_social, nome_fantasia, responsavel — nullable
-- Relaxa `cpf` para nullable (PJ não tem CPF).
-- `nome` continua NOT NULL — o backend preenche com nome_fantasia (ou razão
-- social) ao criar PJ, mantendo compatibilidade com toda a UI que lê `nome`.
-- =============================================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'fisica'
    CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  ADD COLUMN IF NOT EXISTS cnpj          text,
  ADD COLUMN IF NOT EXISTS razao_social  text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS responsavel   text;

-- CPF deixa de ser obrigatório (PJ não tem)
ALTER TABLE clientes ALTER COLUMN cpf DROP NOT NULL;

-- Garante consistência:
--   * PF → cpf obrigatório, cnpj/razao_social NULL
--   * PJ → cnpj + razao_social obrigatórios, cpf NULL
ALTER TABLE clientes
  ADD CONSTRAINT clientes_chk_tipo_pessoa CHECK (
    (tipo_pessoa = 'fisica'   AND cpf  IS NOT NULL AND cnpj IS NULL AND razao_social IS NULL)
    OR
    (tipo_pessoa = 'juridica' AND cnpj IS NOT NULL AND razao_social IS NOT NULL AND cpf IS NULL)
  );

-- Unicidade do CNPJ por empresa (mesma lógica do CPF)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_cnpj_uniq
  ON clientes (empresa_id, cnpj)
  WHERE cnpj IS NOT NULL;
