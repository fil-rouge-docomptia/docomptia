ALTER TABLE accounting_entry_lines
    ADD COLUMN supplier_account_id BIGINT REFERENCES supplier_accounts(supplier_account_id);

CREATE INDEX idx_accounting_entry_lines_supplier_account
    ON accounting_entry_lines (supplier_account_id);
