INSERT INTO organizations (organization_id, name, legal_name, siret, email, phone, address, default_currency_code, validation_required, created_at, updated_at)
VALUES (1, 'Facturation Demo', 'Facturation Demo SARL', '55210055400013', 'contact@facturation-demo.fr', '0102030405', '10 rue de Paris, 75001 Paris', 'EUR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO subscription_plans (subscription_plan_id, code, name, active)
VALUES (1, 'STARTER', 'Starter', true);
INSERT INTO subscription_plans (subscription_plan_id, code, name, active)
VALUES (2, 'BUSINESS', 'Business', true);
INSERT INTO subscription_plans (subscription_plan_id, code, name, active)
VALUES (3, 'PRO', 'Pro', true);
ALTER TABLE subscription_plans ALTER COLUMN subscription_plan_id RESTART WITH 4;

INSERT INTO subscription_plan_limits (subscription_plan_limit_id, subscription_plan_id, valid_from, valid_to, max_active_users, monthly_invoice_limit)
VALUES (1, 1, '2026-09-01', null, 2, 100),
       (2, 2, '2026-09-01', null, 10, 1000),
       (3, 3, '2026-09-01', null, null, null);
ALTER TABLE subscription_plan_limits ALTER COLUMN subscription_plan_limit_id RESTART WITH 4;

INSERT INTO subscription_plan_features (subscription_plan_id, feature_order, feature_code)
VALUES (1, 0, 'INVOICE_MANAGEMENT'), (1, 1, 'OCR'), (1, 2, 'ACCOUNTING_EXPORT');
INSERT INTO subscription_plan_features (subscription_plan_id, feature_order, feature_code)
VALUES (2, 0, 'INVOICE_MANAGEMENT'), (2, 1, 'OCR'), (2, 2, 'ACCOUNTING_EXPORT'),
       (2, 3, 'APPROVAL_WORKFLOW'), (2, 4, 'AUDIT_LOG');
INSERT INTO subscription_plan_features (subscription_plan_id, feature_order, feature_code)
VALUES (3, 0, 'INVOICE_MANAGEMENT'), (3, 1, 'OCR'), (3, 2, 'ACCOUNTING_EXPORT'),
       (3, 3, 'APPROVAL_WORKFLOW'), (3, 4, 'AUDIT_LOG'), (3, 5, 'API_ACCESS'),
       (3, 6, 'ADVANCED_CONNECTORS');

INSERT INTO organization_subscriptions (organization_subscription_id, organization_id, subscription_plan_id, status, start_date, end_date, next_billing_date)
VALUES (1, 1, 1, 'ACTIVE', '2026-09-01', null, '2026-10-01');
ALTER TABLE organization_subscriptions ALTER COLUMN organization_subscription_id RESTART WITH 2;

ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 2;

INSERT INTO roles (role_id, code, label, description)
VALUES (1, 'ADMIN', 'Administrateur', 'Administration generale de la plateforme');

INSERT INTO roles (role_id, code, label, description)
VALUES (2, 'OPERATEUR_COMPTABLE', 'Operateur comptable', 'Traitement des factures et suivi operationnel');

INSERT INTO roles (role_id, code, label, description)
VALUES (3, 'RESPONSABLE_COMPTABLE', 'Responsable comptable', 'Supervision comptable et validation');

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

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (12, 'PAYEE', 'Payee', 'Reglement de la facture confirme');

INSERT INTO invoice_statuses (invoice_status_id, code, label, description)
VALUES (13, 'BROUILLON', 'Brouillon', 'Facture client en cours de preparation');

INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, is_active, created_at, updated_at)
VALUES (1, 1, 1, 'Admin', 'Demo', 'admin@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
