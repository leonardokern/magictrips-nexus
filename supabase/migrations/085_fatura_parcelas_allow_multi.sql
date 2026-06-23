-- Permite que uma parcela apareça em múltiplas faturas.
-- Antes: UNIQUE(parcela_id) impedia reemissão com mesma parcela em fatura diferente.
-- Agora: a deduplicação é feita por lógica de conjunto exato na application layer.
ALTER TABLE fatura_parcelas DROP CONSTRAINT IF EXISTS fatura_parcelas_parcela_id_key;

-- Garante que a mesma parcela não apareça duas vezes DENTRO da mesma fatura.
ALTER TABLE fatura_parcelas ADD CONSTRAINT fatura_parcelas_fatura_parcela_unique UNIQUE (fatura_id, parcela_id);
