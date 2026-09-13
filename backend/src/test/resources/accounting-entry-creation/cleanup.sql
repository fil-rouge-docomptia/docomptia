DELETE FROM audit_logs WHERE (entity_name='Invoice' AND entity_id BETWEEN 901 AND 906)
 OR (entity_name='AccountingEntry' AND entity_id IN (SELECT accounting_entry_id FROM accounting_entries WHERE invoice_id BETWEEN 901 AND 906))
 OR (entity_name='AccountingEntryLine' AND entity_id IN (SELECT accounting_entry_line_id FROM accounting_entry_lines WHERE accounting_entry_id IN (SELECT accounting_entry_id FROM accounting_entries WHERE invoice_id BETWEEN 901 AND 906)));
DELETE FROM accounting_entry_mutations WHERE accounting_entry_id IN (SELECT accounting_entry_id FROM accounting_entries WHERE invoice_id BETWEEN 901 AND 906);
DELETE FROM accounting_entry_lines WHERE accounting_entry_id IN (SELECT accounting_entry_id FROM accounting_entries WHERE invoice_id BETWEEN 901 AND 906);
DELETE FROM accounting_entries WHERE invoice_id BETWEEN 901 AND 906;
DELETE FROM invoice_status_history WHERE invoice_id BETWEEN 901 AND 906;
DELETE FROM invoice_duplicate_alerts WHERE invoice_id BETWEEN 901 AND 906;
DELETE FROM invoices WHERE invoice_id BETWEEN 901 AND 906;
DELETE FROM classifications WHERE classification_id=910;
DELETE FROM accounting_journals WHERE accounting_journal_id BETWEEN 910 AND 912;
DELETE FROM chart_of_accounts WHERE account_id BETWEEN 910 AND 911;
DELETE FROM suppliers WHERE supplier_id=900;
DELETE FROM clients WHERE client_id=900;
DELETE FROM organizations WHERE organization_id=900;
