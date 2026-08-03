ALTER TABLE IF EXISTS ocr_extractions
ALTER COLUMN raw_text TYPE TEXT;

DROP TABLE IF EXISTS accounting_entry_line_templates;

INSERT INTO organizations (organization_id, name, legal_name, siret, email, phone, address, created_at, updated_at)
VALUES (1, 'Facturation Demo', 'Facturation Demo SARL', '12345678901234', 'contact@facturation-demo.fr', '0102030405', '10 rue de Paris, 75001 Paris', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description)
VALUES (1, 'ADMIN', 'Administrateur', 'Administration generale de la plateforme')
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description)
VALUES (2, 'OPERATEUR_COMPTABLE', 'Operateur comptable', 'Traitement des factures et suivi operationnel')
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description)
VALUES (3, 'RESPONSABLE_COMPTABLE', 'Responsable comptable', 'Supervision comptable et validation')
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (1, 'DEPOSEE', 'Deposee', 'Facture deposee dans la plateforme')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (2, 'OCR_EN_COURS', 'OCR en cours', 'Facture en cours de traitement OCR')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (3, 'EXTRAITE', 'Extraite', 'Donnees extraites avec succes')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (4, 'COMPTABILISEE', 'Comptabilisee', 'Ecriture comptable generee')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (5, 'VALIDEE', 'Validee', 'Facture validee')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (6, 'REJETEE', 'Rejetee', 'Facture rejetee')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (7, 'ERREUR_OCR', 'Erreur OCR', 'Echec du traitement OCR')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, is_active, created_at, updated_at)
VALUES (1, 1, 1, 'Admin', 'Demo', 'admin@facturation-demo.fr', 'admin123', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO suppliers (supplier_id, organization_id, name, legal_name, siret, vat_number, email, phone, address, created_at, updated_at)
VALUES (1, 1, 'Orange', 'Orange SA', '38012986600014', 'FR89380129866', 'factures@orange.com', '3900', '111 quai du President Roosevelt, 92130 Issy-les-Moulineaux', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (supplier_id) DO NOTHING;

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (1, 1, '401000', 'Fournisseurs', 'PASSIF', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (2, 1, '607000', 'Achats de marchandises', 'CHARGE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (3, 1, '445660', 'TVA deductible sur autres biens et services', 'ACTIF', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (4, 1, '626000', 'Frais de telecommunications', 'CHARGE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO accounting_rules (
    accounting_rule_id,
    organization_id,
    supplier_id,
    rule_name,
    keyword,
    expense_account_id,
    vat_account_id,
    supplier_account_id,
    priority,
    is_active,
    created_at,
    updated_at
)
VALUES (1, 1, 1, 'Factures Orange telecom', null, 4, 3, 1, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (accounting_rule_id) DO NOTHING;

INSERT INTO accounting_rules (
    accounting_rule_id,
    organization_id,
    supplier_id,
    rule_name,
    keyword,
    expense_account_id,
    vat_account_id,
    supplier_account_id,
    priority,
    is_active,
    created_at,
    updated_at
)
VALUES (2, 1, null, 'Factures fournisseurs par defaut', null, 2, 3, 1, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (accounting_rule_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('organizations', 'organization_id'), COALESCE((SELECT MAX(organization_id) FROM organizations), 1), true);
SELECT setval(pg_get_serial_sequence('roles', 'role_id'), COALESCE((SELECT MAX(role_id) FROM roles), 1), true);
SELECT setval(pg_get_serial_sequence('invoice_statuses', 'invoice_status_id'), COALESCE((SELECT MAX(invoice_status_id) FROM invoice_statuses), 1), true);
SELECT setval(pg_get_serial_sequence('users', 'user_id'), COALESCE((SELECT MAX(user_id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('suppliers', 'supplier_id'), COALESCE((SELECT MAX(supplier_id) FROM suppliers), 1), true);
SELECT setval(pg_get_serial_sequence('chart_of_accounts', 'account_id'), COALESCE((SELECT MAX(account_id) FROM chart_of_accounts), 1), true);
SELECT setval(pg_get_serial_sequence('accounting_rules', 'accounting_rule_id'), COALESCE((SELECT MAX(accounting_rule_id) FROM accounting_rules), 1), true);
