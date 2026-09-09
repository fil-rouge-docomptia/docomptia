CREATE TABLE IF NOT EXISTS supplier_accounts (
    supplier_account_id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(organization_id),
    collective_account_id BIGINT NOT NULL REFERENCES chart_of_accounts(account_id),
    supplier_id BIGINT REFERENCES suppliers(supplier_id),
    code VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_supplier_accounts_organization_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_supplier_accounts_organization_active
    ON supplier_accounts (organization_id, is_active);
