CREATE TABLE IF NOT EXISTS accounting_journals (
    accounting_journal_id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(organization_id),
    code VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL,
    CONSTRAINT uk_accounting_journals_organization_code UNIQUE (organization_id, code)
);

ALTER TABLE accounting_entries
    ADD COLUMN IF NOT EXISTS accounting_journal_id BIGINT REFERENCES accounting_journals(accounting_journal_id);
ALTER TABLE accounting_entries
    ADD COLUMN IF NOT EXISTS export_batch_id BIGINT REFERENCES export_batches(export_batch_id);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_journal_date
    ON accounting_entries (accounting_journal_id, entry_date, accounting_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_export_batch
    ON accounting_entries (export_batch_id);

-- The legacy exporter only included the original GENERATED entry of each invoice.
-- A completed batch is evidence; the invoice status alone is not.
UPDATE accounting_entries entry
SET export_batch_id = (
    SELECT batch.export_batch_id FROM invoices invoice
    JOIN export_batches batch ON batch.export_batch_id = invoice.export_batch_id
    WHERE invoice.invoice_id = entry.invoice_id
      AND batch.organization_id = invoice.organization_id
      AND batch.status IN ('GENERE', 'ARCHIVE')
)
WHERE entry.export_batch_id IS NULL
  AND entry.status = 'GENERATED'
  AND entry.reversed_accounting_entry_id IS NULL
  AND (SELECT COUNT(*) FROM accounting_entries candidate
       WHERE candidate.invoice_id = entry.invoice_id
         AND candidate.reversed_accounting_entry_id IS NULL) = 1;
