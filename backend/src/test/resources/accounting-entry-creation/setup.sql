INSERT INTO organizations (organization_id,name,legal_name,siret,email,validation_required) VALUES (900,'Other','Other','90000000000000','other@example.com',true);
INSERT INTO suppliers (supplier_id,organization_id,name,legal_name) VALUES (900,900,'Secret','Secret supplier');
INSERT INTO clients (client_id,organization_id,name) VALUES (900,1,'Customer');
INSERT INTO accounting_journals (accounting_journal_id,organization_id,code,label,active) VALUES (910,1,'MAN','Manual',true),(911,1,'OLD','Inactive',false),(912,900,'SEC','Secret',true);
INSERT INTO classifications (classification_id,organization_id,classification_type,name,active) VALUES (910,1,'CHANTIER','Site',true);
INSERT INTO chart_of_accounts (account_id,organization_id,account_number,account_label,account_type,is_active) VALUES (910,1,'699910','Inactive','CHARGE',false),(911,900,'699911','Secret','CHARGE',true);
INSERT INTO invoices (invoice_id,organization_id,supplier_id,invoice_status_id,created_by_user_id,invoice_number,invoice_date,currency_code,total_ht,total_tva,total_ttc) VALUES
(901,1,1,5,1,'MAN-901','2026-09-01','EUR',100,20,120),
(902,900,900,5,1,'SECRET','2026-09-01','EUR',100,20,120),
(903,1,1,8,1,'MAN-903','2026-09-01','EUR',100,20,120),
(904,1,null,5,1,'MAN-904','2026-09-01','EUR',100,20,120),
(905,1,1,5,1,'MAN-905','2026-09-01','EUR',100,20,120),
(906,1,1,5,1,'MAN-906','2026-09-02','EUR',100,20,120);
UPDATE invoices SET client_id=900 WHERE invoice_id=905;
