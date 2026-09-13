ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE accounting_entry_lines ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2);
ALTER TABLE accounting_entry_lines ADD COLUMN IF NOT EXISTS classification_id BIGINT REFERENCES classifications(classification_id);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_classification ON accounting_entry_lines(classification_id);
CREATE TABLE IF NOT EXISTS accounting_entry_mutations (
    accounting_entry_mutation_id BIGSERIAL PRIMARY KEY,
    accounting_entry_id BIGINT NOT NULL REFERENCES accounting_entries(accounting_entry_id),
    request_key VARCHAR(36) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    CONSTRAINT uk_accounting_entry_mutation_key UNIQUE(accounting_entry_id, request_key)
);
-- Historical VAT/classification values stay null: never infer them from the invoice.
