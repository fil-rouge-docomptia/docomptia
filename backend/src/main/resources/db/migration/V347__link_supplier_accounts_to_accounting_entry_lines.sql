ALTER TABLE accounting_entry_lines
    ADD COLUMN IF NOT EXISTS supplier_account_id BIGINT REFERENCES supplier_accounts(supplier_account_id);

CREATE INDEX IF NOT EXISTS idx_accounting_entry_lines_supplier_account
    ON accounting_entry_lines (supplier_account_id);
