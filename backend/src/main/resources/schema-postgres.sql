ALTER TABLE invoices ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_date DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_ht DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_tva DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_ttc DROP NOT NULL;

CREATE TABLE IF NOT EXISTS classifications (
    classification_id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(organization_id),
    classification_type VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_classifications_organization_type_name
        UNIQUE (organization_id, classification_type, name)
);
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS classification_id BIGINT REFERENCES classifications(classification_id);

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

CREATE TABLE IF NOT EXISTS invoice_validation_decisions (
    invoice_validation_decision_id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(invoice_id),
    decision_type VARCHAR(30) NOT NULL,
    decided_by_user_id BIGINT NOT NULL REFERENCES users(user_id),
    decided_at TIMESTAMP NOT NULL,
    reason VARCHAR(255)
);
