INSERT INTO organizations (organization_id, name, legal_name, siret, email, phone, address, default_currency_code, validation_required, created_at, updated_at)
VALUES (1, 'Facturation Demo', 'Facturation Demo SARL', '55210055400013', 'contact@facturation-demo.fr', '0102030405', '10 rue de Paris, 75001 Paris', 'EUR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 2;

INSERT INTO roles (role_id, organization_id, code, label, description, is_system)
VALUES (1, null, 'OWNER', 'Owner', 'Responsable proprietaire de l organisation', true);

INSERT INTO roles (role_id, organization_id, code, label, description, is_system)
VALUES (2, null, 'ACCOUNTANT', 'Accountant', 'Traitement des factures et suivi operationnel', true);

INSERT INTO roles (role_id, organization_id, code, label, description, is_system)
VALUES (3, null, 'ACCOUNTING_MANAGER', 'Accounting Manager', 'Supervision comptable et validation', true);

INSERT INTO roles (role_id, organization_id, code, label, description, is_system)
VALUES (4, null, 'ADMIN', 'Administrator', 'Administration generale de la plateforme', true);

INSERT INTO roles (role_id, organization_id, code, label, description, is_system)
VALUES (5, null, 'APPROVER', 'Approver', 'Validation des factures', true);

INSERT INTO roles (role_id, organization_id, code, label, description, is_system)
VALUES (6, null, 'VIEWER', 'Viewer', 'Consultation en lecture seule', true);

ALTER TABLE roles ALTER COLUMN role_id RESTART WITH 7;

INSERT INTO permissions (permission_id, code, label, description)
VALUES
    (1, 'user.profile.read', 'View own profile', 'Consultation du profil utilisateur courant'),
    (2, 'reference-data.read', 'View reference data', 'Consultation des donnees de reference'),
    (3, 'organization.read', 'View organization', 'Consultation de l organisation courante'),
    (4, 'organization.manage', 'Manage organization', 'Modification de l organisation courante'),
    (5, 'dashboard.read', 'View dashboard', 'Consultation du dashboard'),
    (6, 'invoice.read', 'View invoices', 'Consultation des factures'),
    (7, 'invoice.upload', 'Upload supplier invoices', 'Depot de factures fournisseurs'),
    (8, 'invoice.correct', 'Correct invoices', 'Correction des champs de facture'),
    (9, 'invoice.submit-for-validation', 'Submit invoices for validation', 'Envoi en validation'),
    (10, 'invoice.retry-ocr', 'Retry OCR', 'Relance de l OCR'),
    (11, 'invoice.review-duplicate', 'Review duplicate alerts', 'Decision sur doublon probable'),
    (12, 'invoice.assign', 'Assign invoices', 'Affectation des factures'),
    (13, 'invoice.classify', 'Classify invoices', 'Classement des factures'),
    (14, 'invoice.approve', 'Approve invoices', 'Validation, demande de correction ou rejet'),
    (15, 'invoice.accounting.generate', 'Generate accounting entries', 'Generation des ecritures comptables'),
    (16, 'accounting-entry.update', 'Update accounting entries', 'Correction des lignes comptables'),
    (17, 'supplier.read', 'View suppliers', 'Consultation des fournisseurs'),
    (18, 'supplier.manage', 'Manage suppliers', 'Modification des fournisseurs'),
    (19, 'accounting-configuration.read', 'View accounting configuration', 'Consultation du parametrage comptable'),
    (20, 'accounting-configuration.manage', 'Manage accounting configuration', 'Modification du parametrage comptable'),
    (21, 'classification.read', 'View classifications', 'Consultation des classements'),
    (22, 'classification.manage', 'Manage classifications', 'Modification des classements'),
    (23, 'member.read', 'View members', 'Consultation des membres'),
    (24, 'member.invite', 'Invite members', 'Invitation de membres'),
    (25, 'member.update', 'Update members', 'Modification des membres'),
    (26, 'member.status.update', 'Update member status', 'Activation ou desactivation des membres'),
    (27, 'member.role.update', 'Update member roles', 'Modification des roles attribues'),
    (28, 'member.owner.manage', 'Manage Owner role', 'Attribution ou retrait du role Owner'),
    (29, 'role.read', 'View roles', 'Consultation des roles');

ALTER TABLE permissions ALTER COLUMN permission_id RESTART WITH 30;

INSERT INTO role_permissions (role_id, permission_id)
VALUES
    (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
    (1, 11), (1, 12), (1, 13), (1, 14), (1, 15), (1, 16), (1, 17), (1, 18), (1, 19),
    (1, 20), (1, 21), (1, 22), (1, 23), (1, 24), (1, 25), (1, 26), (1, 27), (1, 28),
    (1, 29),
    (2, 1), (2, 2), (2, 3), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10), (2, 11),
    (2, 12), (2, 13), (2, 15), (2, 16), (2, 17), (2, 18), (2, 19), (2, 21),
    (3, 1), (3, 2), (3, 3), (3, 5), (3, 6), (3, 14), (3, 15), (3, 16), (3, 17),
    (3, 19), (3, 21),
    (4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10),
    (4, 11), (4, 12), (4, 13), (4, 14), (4, 15), (4, 16), (4, 17), (4, 18), (4, 19),
    (4, 20), (4, 21), (4, 22), (4, 23), (4, 24), (4, 25), (4, 26), (4, 27), (4, 29),
    (5, 1), (5, 2), (5, 3), (5, 5), (5, 6), (5, 14), (5, 17), (5, 19), (5, 21),
    (6, 1), (6, 2), (6, 3), (6, 5), (6, 6), (6, 17), (6, 19), (6, 21);

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (1, 'DEPOSEE', 'Deposee', 'Facture deposee dans la plateforme');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (2, 'OCR_EN_COURS', 'OCR en cours', 'Facture en cours de traitement OCR');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (3, 'EXTRAITE', 'Extraite', 'Donnees extraites avec succes');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (4, 'COMPTABILISEE', 'Comptabilisee', 'Ecriture comptable generee');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (5, 'VALIDEE', 'Validee', 'Facture validee');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (6, 'REJETEE', 'Rejetee', 'Facture rejetee');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (7, 'ERREUR_OCR', 'Erreur OCR', 'Echec du traitement OCR');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (8, 'A_VERIFIER', 'A verifier', 'Facture corrigee a verifier');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (9, 'EXPORTABLE', 'Exportable', 'Facture validee et prete a etre exportee');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (10, 'EXPORTEE', 'Exportee', 'Facture exportee avec succes');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (11, 'ARCHIVEE', 'Archivee', 'Facture archivee en lecture seule');

INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, is_active, created_at, updated_at)
VALUES (1, 1, 1, 'Admin', 'Demo', 'admin@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO user_roles (user_id, role_id)
VALUES (1, 1);

ALTER TABLE users ALTER COLUMN user_id RESTART WITH 2;

INSERT INTO suppliers (supplier_id, organization_id, name, legal_name, siret, vat_number, email, phone, address, created_at, updated_at)
VALUES (1, 1, 'Orange', 'Orange SA', '38012986600014', 'FR89380129866', 'factures@orange.com', '3900', '111 quai du President Roosevelt, 92130 Issy-les-Moulineaux', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 2;

UPDATE suppliers SET country_code = 'FR' WHERE supplier_id = 1;
UPDATE suppliers SET search_name = 'orange sa orange' WHERE supplier_id = 1;

INSERT INTO supplier_legal_identifiers (supplier_legal_identifier_id, organization_id, supplier_id, type, scheme, country_code, raw_value, normalized_value, source, verified, created_at, updated_at)
VALUES (1, 1, 1, 'BUSINESS_REGISTRATION', 'FR_SIREN', 'FR', '380129866', '380129866', 'IMPORT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO supplier_legal_identifiers (supplier_legal_identifier_id, organization_id, supplier_id, type, scheme, country_code, raw_value, normalized_value, source, verified, created_at, updated_at)
VALUES (2, 1, 1, 'ESTABLISHMENT', 'FR_SIRET', 'FR', '38012986600014', '38012986600014', 'IMPORT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO supplier_legal_identifiers (supplier_legal_identifier_id, organization_id, supplier_id, type, scheme, country_code, raw_value, normalized_value, source, verified, created_at, updated_at)
VALUES (3, 1, 1, 'VAT', 'EU_VAT', 'FR', 'FR89380129866', 'FR89380129866', 'IMPORT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
ALTER TABLE supplier_legal_identifiers ALTER COLUMN supplier_legal_identifier_id RESTART WITH 4;

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (1, 1, '401000', 'Fournisseurs', 'PASSIF', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (2, 1, '607000', 'Achats de marchandises', 'CHARGE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (3, 1, '445660', 'TVA deductible sur autres biens et services', 'ACTIF', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO chart_of_accounts (account_id, organization_id, account_number, account_label, account_type, is_active, created_at, updated_at)
VALUES (4, 1, '626000', 'Frais de telecommunications', 'CHARGE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
VALUES (1, 1, 1, 'Factures Orange telecom', null, 4, 3, 1, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
VALUES (2, 1, null, 'Factures fournisseurs par defaut', null, 2, 3, 1, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
