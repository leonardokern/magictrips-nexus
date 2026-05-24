-- Adiciona coluna icone à tabela tipos_produto
ALTER TABLE tipos_produto
  ADD COLUMN IF NOT EXISTS icone text;

-- Pré-seleciona ícones para os tipos do seed
UPDATE tipos_produto SET icone = '001-aviao'        WHERE nome = 'Aéreo';
UPDATE tipos_produto SET icone = '002-hotel'        WHERE nome = 'Hotel';
UPDATE tipos_produto SET icone = '003-seguro'       WHERE nome = 'Seguro';
UPDATE tipos_produto SET icone = '005-cruzeiro'     WHERE nome = 'Cruzeiro';
UPDATE tipos_produto SET icone = '010-malas'        WHERE nome = 'Pacote';
UPDATE tipos_produto SET icone = '013-onibus'       WHERE nome = 'Transfer';
