-- Data de fim da viagem precisa ser estritamente depois da data de início
-- (antes permitia igual). Alinha o CHECK do banco com a validação de UI/schema.
ALTER TABLE pacotes DROP CONSTRAINT pacotes_check;
ALTER TABLE pacotes ADD CONSTRAINT pacotes_check CHECK (data_fim_viagem > data_inicio_viagem);
