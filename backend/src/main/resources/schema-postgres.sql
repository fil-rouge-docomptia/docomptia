ALTER TABLE invoices ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN invoice_date DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_ht DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_tva DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN total_ttc DROP NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_legal_name_snapshot VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_address_snapshot VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_identifiers_snapshot VARCHAR(1000);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_match_confirmed BOOLEAN;
UPDATE invoices i SET supplier_legal_name_snapshot = s.legal_name,
                      supplier_address_snapshot = s.address,
                      supplier_identifiers_snapshot = concat_ws(', ', s.siret, s.vat_number),
                      supplier_match_confirmed = true
FROM suppliers s WHERE i.supplier_id = s.supplier_id AND i.supplier_legal_name_snapshot IS NULL;

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS uk_suppliers_organization_name;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS uk_suppliers_organization_siret;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS uk_suppliers_organization_vat_number;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS search_name VARCHAR(511);
UPDATE suppliers SET search_name = lower(concat_ws(' ', legal_name, name)) WHERE search_name IS NULL;

CREATE TABLE IF NOT EXISTS supplier_legal_identifiers (
    supplier_legal_identifier_id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(organization_id),
    supplier_id BIGINT NOT NULL REFERENCES suppliers(supplier_id),
    type VARCHAR(30) NOT NULL,
    scheme VARCHAR(40) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    raw_value VARCHAR(255) NOT NULL,
    normalized_value VARCHAR(255) NOT NULL,
    valid_from DATE,
    valid_to DATE,
    source VARCHAR(20) NOT NULL,
    verified BOOLEAN NOT NULL,
    created_by_user_id BIGINT REFERENCES users(user_id),
    change_reason VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

INSERT INTO supplier_legal_identifiers (
    organization_id, supplier_id, type, scheme, country_code, raw_value, normalized_value,
    source, verified, created_at, updated_at
)
SELECT organization_id, supplier_id, 'ESTABLISHMENT', 'FR_SIRET', 'FR', siret,
       regexp_replace(upper(siret), '[^A-Z0-9]', '', 'g'), 'IMPORT', true, created_at, updated_at
FROM suppliers
WHERE siret IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM supplier_legal_identifiers i
      WHERE i.supplier_id = suppliers.supplier_id AND i.scheme = 'FR_SIRET' AND i.valid_to IS NULL
  );

INSERT INTO supplier_legal_identifiers (
    organization_id, supplier_id, type, scheme, country_code, raw_value, normalized_value,
    source, verified, created_at, updated_at
)
SELECT organization_id, supplier_id, 'BUSINESS_REGISTRATION', 'FR_SIREN', 'FR', substring(siret from 1 for 9),
       substring(siret from 1 for 9), 'IMPORT', true, created_at, updated_at
FROM suppliers
WHERE siret ~ '^[0-9]{14}$'
  AND NOT EXISTS (
      SELECT 1 FROM supplier_legal_identifiers i
      WHERE i.supplier_id = suppliers.supplier_id AND i.scheme = 'FR_SIREN' AND i.valid_to IS NULL
  );

INSERT INTO supplier_legal_identifiers (
    organization_id, supplier_id, type, scheme, country_code, raw_value, normalized_value,
    source, verified, created_at, updated_at
)
SELECT organization_id, supplier_id, 'VAT', 'EU_VAT', substring(upper(vat_number) from 1 for 2), vat_number,
       regexp_replace(upper(vat_number), '[^A-Z0-9]', '', 'g'), 'IMPORT', true, created_at, updated_at
FROM suppliers
WHERE vat_number IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM supplier_legal_identifiers i
      WHERE i.supplier_id = suppliers.supplier_id AND i.scheme = 'EU_VAT' AND i.valid_to IS NULL
  );

UPDATE suppliers SET country_code = 'FR'
WHERE country_code IS NULL AND (siret ~ '^[0-9]{14}$' OR upper(vat_number) LIKE 'FR%');

CREATE UNIQUE INDEX IF NOT EXISTS uk_supplier_legal_identifier_active
    ON supplier_legal_identifiers (organization_id, country_code, scheme, normalized_value)
    WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_legal_identifier_search
    ON supplier_legal_identifiers (organization_id, normalized_value);
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_legal_name
    ON suppliers (organization_id, lower(legal_name));
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_search_name
    ON suppliers (organization_id, search_name);

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
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS assigned_user_id BIGINT REFERENCES users(user_id);

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

CREATE TABLE IF NOT EXISTS invoice_comments (
    invoice_comment_id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(invoice_id),
    author_user_id BIGINT NOT NULL REFERENCES users(user_id),
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    recipient_user_id BIGINT NOT NULL REFERENCES users(user_id),
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    invoice_id BIGINT REFERENCES invoices(invoice_id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    email_required BOOLEAN NOT NULL DEFAULT FALSE,
    email_recipient VARCHAR(255),
    email_subject VARCHAR(255),
    email_body TEXT,
    created_at TIMESTAMP NOT NULL
);
