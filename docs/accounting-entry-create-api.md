# Création manuelle d'une écriture — KAN-388

Ce contrat prépare l'action **Create entry** de la page Accounting (frontend KAN-399).
Le périmètre MVP est une **facture fournisseur VALIDEE sans écriture originale**.
Les opérations sans facture et les factures clients ne sont pas prises en charge.
Les deux routes nécessitent l'authentification et `MANAGE_ACCOUNTING_ENTRIES` ;
l'organisation et l'auteur viennent exclusivement de l'utilisateur connecté.

## Sélection d'une facture

`GET /api/v1/accounting-entries/creation-candidates?query=orange&page=0&size=20`

Retourne une page Spring contenant `invoiceId`, `invoiceNumber`, `supplierName`,
`currencyCode` et `invoiceDate`. La recherche, insensible à la casse et aux espaces
externes, porte sur le numéro de facture et la raison sociale du fournisseur.
Le filtrage précède la pagination : seules les factures de l'organisation, avec un
fournisseur de cette organisation, sans client, sans lot d'export, au statut `VALIDEE`,
sans originale et sans alerte de doublon en attente sont proposées. Les factures
supprimées sont exclues par le filtre habituel du modèle.

Tri : date de facture décroissante puis identifiant décroissant. `page >= 0`,
`1 <= size <= 100`, recherche de 200 caractères maximum. Une sélection devenue
obsolète reste contrôlée au moment du POST.

Le journal est choisi parmi les journaux actifs du référentiel
`GET /api/v1/accounting-journals` décrit dans le [contrat de lecture](accounting-entry-read-api.md).
Ce ticket ne crée pas de journal ou de compte implicitement.

## Enregistrement atomique

`POST /api/v1/accounting-entries`, avec un corps JSON :

```json
{
  "invoiceId": 42,
  "entryDate": "2026-09-03",
  "journalId": 2,
  "label": "Achat de fournitures",
  "lines": [
    {"accountId": 10, "lineLabel": "Fournitures", "debitAmount": 100, "creditAmount": 0,
     "vatRate": 20, "classificationId": 8},
    {"accountId": 11, "lineLabel": "TVA", "debitAmount": 20, "creditAmount": 0},
    {"accountId": 12, "lineLabel": "Fournisseur", "debitAmount": 0, "creditAmount": 120}
  ]
}
```

Les identifiants d'exemple doivent être remplacés par des références réelles.
Les cinq champs de l'en-tête sont obligatoires. Les identifiants sont positifs, la date
est une date ISO valide entre les années 0001 et 9999, le libellé est non vide après
suppression des espaces externes et ne dépasse pas 255 caractères. `lines` doit
contenir au moins une ligne, sans élément null. Le nombre de lignes est libre.

Chaque ligne exige `accountId`, `lineLabel`, `debitAmount` et `creditAmount`.
Les validations de compte actif, montants, TVA facultative et affectation analytique
sont exactement celles de la [saisie des lignes KAN-387](accounting-entry-line-api.md),
partagées dans le même service. Aucun taux, montant ou compte auxiliaire n'est déduit
implicitement. Le journal doit être actif dans l'organisation courante.

Le serveur attribue l'identifiant, le numéro provisoire `EC-{invoiceId}`, la nature
`GENERATED`, la version initiale 0, les numéros de ligne consécutifs à partir de 1,
l'auteur et les dates techniques. La numérotation définitive reste attribuée à l'export ;
la création ne consomme pas la séquence de pièces. Le client ne pilote pas ces champs.

**Réponse 201**, en-tête `Location: /api/v1/accounting-entries/{id}`, et corps identique
à la [lecture détaillée KAN-386](accounting-entry-read-api.md) : facture, `entry`
(lignes, version et totaux), journal, preuve d'export, `exportEligible`, `needsAttention`
et diagnostics structurés. Recharger l'écriture restitue les données persistées.

Une proposition déséquilibrée ou avec une ligne zéro/zéro peut être enregistrée :
elle reste non exportable et la facture reste `VALIDEE`. Lorsque les contrôles communs
sont satisfaits, la facture devient `EXPORTABLE`. Pour reprendre une proposition,
utiliser les routes KAN-387 avec sa version et une clé d'idempotence. La validation
commune contrôle aussi la cohérence des montants HT/TVA/TTC de la facture ; saisir un
taux ne recalcule pas ces montants.

## Conflit et concurrence

Une facture ne peut recevoir qu'une originale via ces parcours. Une nouvelle demande
sur une facture qui en possède déjà une retourne **409** :

```json
{
  "code": "ACCOUNTING_ENTRY_ALREADY_EXISTS",
  "message": "The invoice already has an original accounting entry",
  "accountingEntryId": 123,
  "entryUrl": "/api/v1/accounting-entries/123"
}
```

Le frontend peut ouvrir cette écriture après consultation du conflit. L'identifiant
et le lien ne sont communiqués qu'après contrôle d'appartenance de la facture à
l'organisation. La demande ne remplace jamais l'originale, même avec un autre contenu.
Ce contrôle est prioritaire sur l'état de la facture pour une originale existante,
y compris après export ou archivage. Une facture étrangère reste un 404 sans lien.

Le POST n'exige pas `If-Match` ou `Idempotency-Key` : l'unicité par facture fournit la
protection contre le double envoi. Un rejeu après une réponse perdue reçoit le conflit
avec l'écriture existante. La transaction prend le verrou d'organisation partagé avec
l'export, puis le verrou de facture déjà utilisé par la génération automatique. Deux
créations manuelles ou une création manuelle et une génération automatique concurrentes
ne créent ainsi qu'une originale. Le comportement de l'ancien endpoint
`POST /api/v1/invoices/{id}/accounting-entry` est conservé : il peut retourner cette
originale existante.

L'en-tête, toutes les lignes, les audits et l'éventuel changement de statut appartiennent
à une transaction unique : une ligne invalide ou un échec tardif annule l'ensemble.

## Erreurs et audit

| HTTP | Code ou cause |
| --- | --- |
| 400 | `ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR` : en-tête, ligne ou référentiel invalide |
| 400 | JSON, date ou pagination invalide, traité par Spring MVC |
| 401 / 403 | Authentification / permission manquante |
| 404 | `INVOICE_NOT_FOUND`, y compris facture d'une autre organisation |
| 409 | `ACCOUNTING_ENTRY_ALREADY_EXISTS`, avec identifiant et lien autorisés |
| 409 | `ACCOUNTING_ENTRY_CREATION_NOT_ALLOWED` : facture non VALIDEE, client, fournisseur absent/étranger ou lot d'export présent |
| 409 | `ARCHIVED_INVOICE_NOT_MODIFIABLE` : facture archivée sans originale |
| 409 | `DUPLICATE_ALERT_ACTION_NOT_ALLOWED` : alerte de doublon en attente |

`ACCOUNTING_ENTRY_CREATED` trace les champs de l'en-tête dans l'audit et l'identifiant
de l'écriture dans l'historique de la facture (`ACCOUNTING_ACTION`). Chaque ligne reçoit
les traces `LINE_ADDED` existantes avec ses champs. Les traces conservent l'organisation,
l'auteur et la date ; un conflit ou un échec ne crée pas d'audit partiel.

Aucune modification de schéma ni migration supplémentaire : les modèles et migrations
KAN-386/KAN-387 suffisent. Aucun changement frontend dans ce ticket.
