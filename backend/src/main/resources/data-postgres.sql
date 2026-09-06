ALTER TABLE IF EXISTS ocr_extractions
ALTER COLUMN raw_text TYPE TEXT;

DROP TABLE IF EXISTS accounting_entry_line_templates;

INSERT INTO organizations (organization_id, name, legal_name, siret, email, phone, address, default_currency_code, validation_required, created_at, updated_at)
VALUES (1, 'Facturation Demo', 'Facturation Demo SARL', '55210055400013', 'contact@facturation-demo.fr', '0102030405', '10 rue de Paris, 75001 Paris', 'EUR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description, system_role, customizable, assignable, active)
VALUES (1, 'ADMIN', 'Administrateur', 'Administration generale de la plateforme', true, false, true, true)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description, system_role, customizable, assignable, active)
VALUES (2, 'OPERATEUR_COMPTABLE', 'Operateur comptable', 'Traitement des factures et suivi operationnel', true, false, true, true)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description, system_role, customizable, assignable, active)
VALUES (3, 'RESPONSABLE_COMPTABLE', 'Responsable comptable', 'Supervision comptable et validation', true, false, true, true)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO roles (role_id, code, label, description, system_role, customizable, assignable, active) VALUES
(4, 'OWNER', 'Proprietaire', 'Proprietaire de l organisation', true, false, true, true),
(5, 'ACCOUNTING_MANAGER', 'Responsable comptable', 'Supervision de la comptabilite', true, false, true, true),
(6, 'ACCOUNTANT', 'Comptable', 'Traitement comptable', true, false, true, true),
(7, 'APPROVER', 'Validateur', 'Validation des factures', true, false, true, true),
(8, 'VIEWER', 'Lecteur', 'Consultation en lecture seule', true, false, true, true)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO permissions (permission_id, code, domain, label, description) VALUES
(1, 'profile.read', 'profile', 'Consulter son profil', 'Consulter son propre profil'),
(2, 'reference.read', 'reference', 'Consulter les referentiels', 'Consulter les referentiels'),
(3, 'organization.read', 'organization', 'Consulter l organisation', 'Consulter l organisation courante'),
(4, 'organization.manage', 'organization', 'Gerer l organisation', 'Modifier l organisation courante'),
(5, 'invoice.read', 'invoice', 'Consulter les factures', 'Consulter les factures'),
(6, 'dashboard.read', 'dashboard', 'Consulter le dashboard', 'Consulter le dashboard'),
(7, 'invoice.process', 'invoice', 'Traiter les factures', 'Deposer et corriger les factures'),
(8, 'invoice.approve', 'invoice', 'Valider les factures', 'Valider ou refuser les factures'),
(9, 'accounting-entry.manage', 'accounting-entry', 'Gerer les ecritures', 'Generer et corriger les ecritures'),
(10, 'supplier.read', 'supplier', 'Consulter les fournisseurs', 'Consulter les fournisseurs'),
(11, 'supplier.manage', 'supplier', 'Gerer les fournisseurs', 'Modifier les fournisseurs'),
(12, 'accounting-configuration.read', 'accounting-configuration', 'Consulter la configuration comptable', 'Consulter les comptes et regles'),
(13, 'accounting-configuration.manage', 'accounting-configuration', 'Gerer la configuration comptable', 'Modifier les comptes et regles'),
(14, 'classification.read', 'classification', 'Consulter les classements', 'Consulter les classements'),
(15, 'classification.manage', 'classification', 'Gerer les classements', 'Modifier les classements'),
(16, 'user.manage', 'user', 'Gerer les utilisateurs', 'Inviter et modifier les utilisateurs')
ON CONFLICT (permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p WHERE r.code = 'OWNER'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code <> 'invoice.approve' ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.code IN ('profile.read','reference.read','organization.read','invoice.read','dashboard.read','invoice.process','accounting-entry.manage','supplier.read','supplier.manage','accounting-configuration.read','classification.read')
WHERE r.code IN ('OPERATEUR_COMPTABLE','ACCOUNTANT') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.code IN ('profile.read','reference.read','organization.read','invoice.read','dashboard.read','invoice.approve','accounting-entry.manage','supplier.read','accounting-configuration.read','classification.read')
WHERE r.code IN ('RESPONSABLE_COMPTABLE','ACCOUNTING_MANAGER','APPROVER') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p ON p.code IN ('profile.read','reference.read','organization.read','invoice.read','dashboard.read','supplier.read','accounting-configuration.read','classification.read')
WHERE r.code = 'VIEWER' ON CONFLICT DO NOTHING;

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

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (8, 'A_VERIFIER', 'A verifier', 'Facture corrigee a verifier')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (9, 'EXPORTABLE', 'Exportable', 'Facture validee et prete a etre exportee')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (10, 'EXPORTEE', 'Exportee', 'Facture exportee avec succes')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (11, 'ARCHIVEE', 'Archivee', 'Facture archivee en lecture seule')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (12, 'PAYEE', 'Payee', 'Reglement de la facture confirme')
ON CONFLICT (invoice_status_id) DO NOTHING;

INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, is_active, created_at, updated_at)
VALUES (1, 1, 1, 'Admin', 'Demo', 'admin@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash
WHERE users.password_hash NOT LIKE '$2%';

INSERT INTO user_roles (user_id, role_id)
SELECT user_id, role_id FROM users WHERE role_id IS NOT NULL
ON CONFLICT DO NOTHING;

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
SELECT setval(pg_get_serial_sequence('permissions', 'permission_id'), COALESCE((SELECT MAX(permission_id) FROM permissions), 1), true);
SELECT setval(pg_get_serial_sequence('invoice_statuses', 'invoice_status_id'), COALESCE((SELECT MAX(invoice_status_id) FROM invoice_statuses), 1), true);
SELECT setval(pg_get_serial_sequence('users', 'user_id'), COALESCE((SELECT MAX(user_id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('suppliers', 'supplier_id'), COALESCE((SELECT MAX(supplier_id) FROM suppliers), 1), true);
SELECT setval(pg_get_serial_sequence('chart_of_accounts', 'account_id'), COALESCE((SELECT MAX(account_id) FROM chart_of_accounts), 1), true);
SELECT setval(pg_get_serial_sequence('accounting_rules', 'accounting_rule_id'), COALESCE((SELECT MAX(accounting_rule_id) FROM accounting_rules), 1), true);
