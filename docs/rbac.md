# RBAC Et Permissions

Le backend est l'autorite de securite. Les endpoints proteges verifient des
permissions effectives, jamais un nom de role. Le frontend utilise les
permissions retournees par `/api/v1/users/me` pour afficher la navigation, les
actions et les etats d'acces.

## Principes

- Une permission decrit une action atomique, par exemple `invoice.read`,
  `invoice.approve` ou `member.invite`.
- Un utilisateur peut avoir plusieurs roles.
- Les permissions effectives d'un utilisateur sont l'union des permissions de
  ses roles.
- Aucun role ne beneficie d'un bypass code en dur. `OWNER` possede ses droits
  via la meme matrice que les autres roles.
- L'organisation conserve toujours au moins un `OWNER` actif.
- Les changements de roles et de statut utilisateur sont journalises dans
  `audit_logs`.
- Le modele `roles.organization_id` permet d'ajouter plus tard des roles
  personnalises par organisation, sans les exposer dans le MVP.

## Roles Systeme

| Code | Libelle | Intention |
| --- | --- | --- |
| `OWNER` | Owner | Propriete de l'organisation et actions critiques |
| `ADMIN` | Administrator | Administration courante sans retrait du dernier Owner |
| `ACCOUNTING_MANAGER` | Accounting Manager | Supervision comptable, validation et ecritures |
| `ACCOUNTANT` | Accountant | Traitement operationnel des factures fournisseurs |
| `APPROVER` | Approver | Validation ou rejet des factures |
| `VIEWER` | Viewer | Consultation en lecture seule |

## Permissions

| Permission | Action |
| --- | --- |
| `user.profile.read` | Consulter son profil |
| `reference-data.read` | Consulter les donnees de reference |
| `organization.read` | Consulter l'organisation courante |
| `organization.manage` | Modifier l'organisation et ses preferences |
| `dashboard.read` | Consulter le dashboard |
| `invoice.read` | Consulter les factures |
| `invoice.upload` | Deposer une facture fournisseur |
| `invoice.correct` | Corriger les champs extraits |
| `invoice.submit-for-validation` | Envoyer une facture en validation |
| `invoice.retry-ocr` | Relancer l'OCR |
| `invoice.review-duplicate` | Decider d'un doublon probable |
| `invoice.assign` | Affecter une facture |
| `invoice.classify` | Classer une facture |
| `invoice.approve` | Valider, rejeter ou demander correction |
| `invoice.accounting.generate` | Generer l'ecriture comptable d'une facture |
| `accounting-entry.update` | Corriger les lignes comptables |
| `supplier.read` | Consulter les fournisseurs |
| `supplier.manage` | Modifier les fournisseurs |
| `accounting-configuration.read` | Consulter la configuration comptable |
| `accounting-configuration.manage` | Modifier la configuration comptable |
| `classification.read` | Consulter les classements |
| `classification.manage` | Modifier les classements |
| `member.read` | Consulter les membres |
| `member.invite` | Inviter un membre |
| `member.update` | Modifier l'identite d'un membre |
| `member.status.update` | Activer ou desactiver un membre |
| `member.role.update` | Modifier les roles attribues |
| `member.owner.manage` | Attribuer ou retirer le role Owner |
| `role.read` | Consulter les roles |

## Matrice Des Roles Systeme

| Role | Permissions |
| --- | --- |
| `OWNER` | Toutes les permissions |
| `ADMIN` | Toutes les permissions sauf `member.owner.manage` |
| `ACCOUNTING_MANAGER` | `user.profile.read`, `reference-data.read`, `organization.read`, `dashboard.read`, `invoice.read`, `invoice.approve`, `invoice.accounting.generate`, `accounting-entry.update`, `supplier.read`, `accounting-configuration.read`, `classification.read` |
| `ACCOUNTANT` | `user.profile.read`, `reference-data.read`, `organization.read`, `dashboard.read`, `invoice.read`, `invoice.upload`, `invoice.correct`, `invoice.submit-for-validation`, `invoice.retry-ocr`, `invoice.review-duplicate`, `invoice.assign`, `invoice.classify`, `invoice.accounting.generate`, `accounting-entry.update`, `supplier.read`, `supplier.manage`, `accounting-configuration.read`, `classification.read` |
| `APPROVER` | `user.profile.read`, `reference-data.read`, `organization.read`, `dashboard.read`, `invoice.read`, `invoice.approve`, `supplier.read`, `accounting-configuration.read`, `classification.read` |
| `VIEWER` | `user.profile.read`, `reference-data.read`, `organization.read`, `dashboard.read`, `invoice.read`, `supplier.read`, `accounting-configuration.read`, `classification.read` |

## Couverture Endpoints

| Endpoint | Permission |
| --- | --- |
| `GET /api/v1/users/me` | `user.profile.read` |
| `GET /api/v1/reference-data` | `reference-data.read` |
| `GET /api/v1/organizations/current` | `organization.read` |
| `GET /api/v1/organizations/current/onboarding` | `organization.manage` |
| `GET /api/v1/organizations/current/validation-preferences` | `organization.read` |
| `PATCH /api/v1/organizations/current` | `organization.manage` |
| `PATCH /api/v1/organizations/current/validation-preferences` | `organization.manage` |
| `GET /api/v1/dashboard/summary` | `dashboard.read` |
| `GET /api/v1/invoices` et `GET /api/v1/invoices/**` | `invoice.read` |
| `GET /api/v1/invoices/pending-validation` | `invoice.approve` |
| `POST /api/v1/invoices/upload` | `invoice.upload` |
| `PATCH /api/v1/invoices/{id}` | `invoice.correct` |
| `PATCH /api/v1/invoices/{id}/classification` | `invoice.classify` |
| `PATCH /api/v1/invoices/{id}/assignee` | `invoice.assign` |
| `POST /api/v1/invoices/{id}/ocr/retry` | `invoice.retry-ocr` |
| `POST /api/v1/invoices/{id}/submit-for-validation` | `invoice.submit-for-validation` |
| `POST /api/v1/invoices/{id}/duplicate-alerts/{alertId}/decision` | `invoice.review-duplicate` |
| `POST /api/v1/invoices/{id}/validate` | `invoice.approve` |
| `POST /api/v1/invoices/{id}/request-correction` | `invoice.approve` |
| `POST /api/v1/invoices/{id}/reject` | `invoice.approve` |
| `POST /api/v1/invoices/{id}/accounting-entry` | `invoice.accounting.generate` |
| `PATCH /api/v1/accounting-entries/**` | `accounting-entry.update` |
| `GET /api/v1/suppliers` et `GET /api/v1/suppliers/**` | `supplier.read` |
| `PATCH /api/v1/suppliers/{id}` | `supplier.manage` |
| `GET /api/v1/chart-of-accounts/**` | `accounting-configuration.read` |
| `GET /api/v1/accounting-rules/**` | `accounting-configuration.read` |
| `POST /api/v1/chart-of-accounts` | `accounting-configuration.manage` |
| `POST /api/v1/chart-of-accounts/{id}/deactivate` | `accounting-configuration.manage` |
| `PATCH /api/v1/chart-of-accounts/**` | `accounting-configuration.manage` |
| `PATCH /api/v1/accounting-rules/**` | `accounting-configuration.manage` |
| `GET /api/v1/classifications/**` | `classification.read` |
| `POST /api/v1/classifications` | `classification.manage` |
| `POST /api/v1/classifications/{id}/deactivate` | `classification.manage` |
| `PATCH /api/v1/classifications/{id}` | `classification.manage` |
| `GET /api/v1/users` | `member.read` |
| `POST /api/v1/users` | `member.invite` |
| `PATCH /api/v1/users/{id}` | `member.update` |
| `PATCH /api/v1/users/{id}/status` | `member.status.update` |
| `PATCH /api/v1/users/{id}/role` | `member.role.update` |
| `GET /api/v1/roles` | `role.read` |
