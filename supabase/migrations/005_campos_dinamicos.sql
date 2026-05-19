-- =============================================================================
-- 005 — Sistema de Campos Dinâmicos de Produto
-- =============================================================================
-- Três camadas:
--   1. campos_extra          — campos reutilizáveis (texto/dropdown/data/numero)
--   2. campos_extra_opcoes   — opções para campos do tipo dropdown
--   3. tipos_produto         — tipos (Aéreo, Hotel, etc.)
--   4. tipos_produto_campos  — junction: quais campos pertencem a quais tipos
--
-- Snapshot dos valores em venda_produtos.valores_extras (JSONB) preserva
-- histórico mesmo se o campo for editado/excluído depois.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tipos_produto
-- ---------------------------------------------------------------------------
CREATE TABLE tipos_produto (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tipos_produto IS 'Tipos de produto (Aéreo, Hotel, Cruzeiro...). Os campos são definidos via tipos_produto_campos.';

-- ---------------------------------------------------------------------------
-- campos_extra
-- ---------------------------------------------------------------------------
CREATE TABLE campos_extra (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL UNIQUE,
  tipo_campo    text NOT NULL CHECK (tipo_campo IN ('texto', 'dropdown', 'data', 'numero')),
  placeholder   text,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campos_extra IS 'Campos reutilizáveis (Companhia Aérea, Trecho, Número do Voo...). Independentes de tipo.';

-- ---------------------------------------------------------------------------
-- campos_extra_opcoes
-- ---------------------------------------------------------------------------
CREATE TABLE campos_extra_opcoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id    uuid NOT NULL REFERENCES campos_extra(id) ON DELETE CASCADE,
  valor       text NOT NULL,
  ordem       int NOT NULL DEFAULT 1,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (campo_id, valor)
);

COMMENT ON TABLE campos_extra_opcoes IS 'Opções para campos do tipo dropdown (ex: LATAM, GOL, AZUL para Companhia Aérea)';

CREATE INDEX idx_campos_extra_opcoes_campo ON campos_extra_opcoes(campo_id);

-- ---------------------------------------------------------------------------
-- tipos_produto_campos (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE tipos_produto_campos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_produto_id  uuid NOT NULL REFERENCES tipos_produto(id) ON DELETE CASCADE,
  campo_id         uuid NOT NULL REFERENCES campos_extra(id) ON DELETE CASCADE,
  ordem            int NOT NULL DEFAULT 1,
  obrigatorio      boolean NOT NULL DEFAULT false,

  UNIQUE (tipo_produto_id, campo_id)
);

COMMENT ON TABLE tipos_produto_campos IS 'Junction: quais campos extras pertencem a quais tipos de produto (com ordem + obrigatório)';

CREATE INDEX idx_tipos_produto_campos_tipo ON tipos_produto_campos(tipo_produto_id);
CREATE INDEX idx_tipos_produto_campos_campo ON tipos_produto_campos(campo_id);

-- =============================================================================
-- Seed
-- =============================================================================

-- Tipos de produto
INSERT INTO tipos_produto (nome) VALUES
  ('Aéreo'),
  ('Hotel'),
  ('Cruzeiro'),
  ('Transfer'),
  ('Pacote'),
  ('Seguro');

-- Campos extras
INSERT INTO campos_extra (nome, tipo_campo, placeholder) VALUES
  ('Companhia Aérea', 'dropdown', 'Selecione a companhia'),
  ('Trecho',          'texto',    'Ex: CGH-SSA');

-- Opções para "Companhia Aérea"
INSERT INTO campos_extra_opcoes (campo_id, valor, ordem)
SELECT id, valor, ordem
FROM campos_extra,
     (VALUES
        ('LATAM',           1),
        ('GOL',             2),
        ('AZUL',            3),
        ('American Airlines', 4),
        ('Air France',      5),
        ('KLM',             6),
        ('Delta',           7),
        ('United',          8),
        ('TAP',             9),
        ('Iberia',         10),
        ('Emirates',       11),
        ('Lufthansa',      12),
        ('British Airways',13),
        ('Outra',          99)
     ) AS opts(valor, ordem)
WHERE campos_extra.nome = 'Companhia Aérea';

-- Associação: campos "Companhia Aérea" e "Trecho" ao tipo "Aéreo"
INSERT INTO tipos_produto_campos (tipo_produto_id, campo_id, ordem, obrigatorio)
SELECT tp.id, ce.id, posicao.ordem, posicao.obrig
FROM tipos_produto tp
CROSS JOIN LATERAL (
  VALUES
    ('Companhia Aérea', 1, true),
    ('Trecho',          2, true)
) AS posicao(nome_campo, ordem, obrig)
JOIN campos_extra ce ON ce.nome = posicao.nome_campo
WHERE tp.nome = 'Aéreo';
