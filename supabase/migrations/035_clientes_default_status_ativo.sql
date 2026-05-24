-- =============================================================================
-- 035 — Default de status de cliente passa para 'ativo'
-- =============================================================================
-- Cliente novo cadastrado via Nexus já entra como 'ativo'. O status 'lead'
-- continua existindo no enum — fica reservado para clientes vindos de
-- integração externa (ex: RD Station) que ainda não viraram conta.
-- =============================================================================

ALTER TABLE clientes ALTER COLUMN status SET DEFAULT 'ativo';
