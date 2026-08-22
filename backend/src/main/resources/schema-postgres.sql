ALTER TABLE invoices ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_date DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_ht DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_tva DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_ttc DROP NOT NULL;

ALTER TABLE IF EXISTS invoice_duplicate_alerts ALTER COLUMN invoice_date DROP NOT NULL;
ALTER TABLE IF EXISTS invoice_duplicate_alerts ALTER COLUMN total_ttc DROP NOT NULL;
ALTER TABLE IF EXISTS invoice_duplicate_alerts
    ADD COLUMN IF NOT EXISTS decision VARCHAR(20);
UPDATE invoice_duplicate_alerts SET decision = 'PENDING' WHERE decision IS NULL;
ALTER TABLE invoice_duplicate_alerts ALTER COLUMN decision SET DEFAULT 'PENDING';
ALTER TABLE invoice_duplicate_alerts ALTER COLUMN decision SET NOT NULL;
ALTER TABLE IF EXISTS invoice_duplicate_alerts
    ADD COLUMN IF NOT EXISTS decided_by_user_id BIGINT REFERENCES users(user_id);
ALTER TABLE IF EXISTS invoice_duplicate_alerts
    ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP;
ALTER TABLE IF EXISTS invoice_duplicate_alerts
    ADD COLUMN IF NOT EXISTS decision_reason VARCHAR(255);
