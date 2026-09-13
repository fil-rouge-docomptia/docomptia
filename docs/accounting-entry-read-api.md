# Lecture des écritures et journaux comptables — KAN-386

Les lectures sont limitées à l'organisation de l'utilisateur connecté et demandent la
permission `MANAGE_ACCOUNTING_ENTRIES` (les trois rôles MVP). Une lecture ne modifie aucun
statut, journal, lot ou historique. Les routes de correction et de génération conservent
leur contrat.

## Écritures

`GET /api/v1/accounting-entries` retourne une page Spring (`content`, `totalElements`,
`totalPages`, etc.). Tous les filtres et le tri sont appliqués en base **avant** pagination.

| Paramètre | Contrat |
| --- | --- |
| `page`, `size` | Base zéro ; défauts 0 et 20 ; taille de 1 à 100. |
| `query` | Recherche partielle insensible à la casse sur pièce, libellé, numéro de facture et fournisseur ; 200 caractères maximum. |
| `status` | Nature de l'écriture : `GENERATED`, `REVERSAL`, `CORRECTIVE`. |
| `balanced` | Égalité arithmétique exacte entre somme des débits et somme des crédits. |
| `startDate`, `endDate` | Dates ISO `yyyy-MM-dd`, bornes inclusives sur `entryDate`, indépendamment facultatives. |
| `journalId` | Identifiant positif d'un journal de l'organisation. Un journal absent ou étranger donne une page vide. |
| `exportStatus` | `NOT_EXPORTED` ou `EXPORTED`, selon le lien propre à l'écriture vers un lot terminé. |
| `sortBy` | `entryDate` (défaut), `entryNumber`, `invoiceNumber`, `supplierName`, `journalCode`. |
| `direction` | `ASC` ou `DESC` (défaut) ; départage par identifiant d'écriture dans le même sens. |

Une pagination invalide, une période inversée, un identifiant non positif, une valeur enum
inconnue ou une colonne de tri non supportée retourne `400`. Les montants agrégés ne sont
pas des colonnes de tri supportées. Aucun compteur métier ni total mélangeant les devises
n'est ajouté ; `totalElements` dénombre les écritures correspondant aux filtres.

`GET /api/v1/accounting-entries/{id}` retourne le même élément enrichi ; une écriture
absente ou étrangère retourne `404`. Les champs existants `invoiceId`, `invoiceNumber`,
`supplierName`, `currencyCode`, `invoiceStatus` et `entry` sont conservés. Les nouveaux
champs sont :

| Champ | Signification |
| --- | --- |
| `journal` | `{accountingJournalId, code, label, active}` issu du référentiel, ou `null`. |
| `exportStatus` | `EXPORTED` uniquement si cette écriture référence un lot de son organisation au statut `GENERE` ou `ARCHIVE` ; sinon `NOT_EXPORTED`. |
| `exportBatchId`, `exportedAt` | Identifiant du lot terminé et son `generatedAt` ; `null` sans lot terminé. Une date historique inconnue reste `null`. |
| `exportEligible` | Écriture non exportée, sans lot, acceptée par les contrôles communs et le workflow d'export actuel. |
| `needsAttention` | Présence d'au moins un diagnostic bloquant. |
| `diagnostics` | Liste de `{code, message, blocking, accountingEntryLineId}`. L'identifiant de ligne reste `null` pour une anomalie globale. |

`entry.status`, `entry.balanced`, `needsAttention` et `exportStatus` sont indépendants.
Une écriture équilibrée peut être bloquée par un compte inactif ou une facture non
exportable. Une extourne n'hérite jamais du statut d'export de son originale. Une écriture
exportée peut présenter une anomalie détectée aujourd'hui sans perdre sa preuve d'export.

L'éligibilité décrit les contrôles communs CSV et le workflow actuel fondé sur les factures
`EXPORTABLE` sans lot. Les extournes et correctives restent bloquées avec
`ENTRY_EXPORT_WORKFLOW_UNAVAILABLE` jusqu'à l'export par écriture prévu dans KAN-390.
Le précontrôle `/api/v1/accounting-exports/preflight` reste nécessaire pour le format
choisi, notamment le FEC ; cette lecture ne réserve aucune sélection. `exportEligible`
et `needsAttention` ne sont pas des paramètres de filtrage de cet endpoint.

## Diagnostics

Les contrôles de montants HT/TVA/TTC, d'équilibre et de comptes réutilisent
`AccountingExportValidator`. Une anomalie de compte identifie sa ligne réelle ; un
déséquilibre global ne désigne aucune ligne coupable. Les messages sont informatifs :
les consommateurs doivent utiliser les codes stables.

| Code supplémentaire | Bloquant | Sens |
| --- | --- | --- |
| `JOURNAL_NOT_ASSIGNED` | Non | Aucun journal affecté ; aucune valeur telle que `ACH` n'est inventée. |
| `JOURNAL_INACTIVE` | Non | Journal historique désactivé, toujours affiché. |
| `JOURNAL_OUTSIDE_ORGANIZATION` | Oui | Référence incohérente ; le journal étranger n'est pas exposé. |
| `EXPORT_BATCH_OUTSIDE_ORGANIZATION` | Oui | Référence incohérente ; le lot étranger n'est pas exposé. |
| `EXPORT_BATCH_NOT_FINALIZED` | Oui | Le lot de l'écriture n'a pas terminé sa génération. |
| `ENTRY_EXPORT_WORKFLOW_UNAVAILABLE` | Oui | Nature d'écriture non prise en charge par l'export actuel. |
| `INVOICE_NOT_EXPORTABLE` | Oui | Facture non `EXPORTABLE` ou déjà rattachée à un lot. |

L'absence ou l'inactivité d'un journal reste un avertissement pour préserver les règles
actuelles CSV/FEC, qui n'utilisent pas encore ce référentiel. L'affectation et les règles
de disponibilité des journaux sont traitées par les tickets suivants de l'épic.

## Référentiel des journaux

`GET /api/v1/accounting-journals?page=0&size=20` retourne une page de
`{accountingJournalId, code, label, active}`, triée par code puis identifiant croissants.
Les limites de pagination sont les mêmes que pour les écritures. Les journaux inactifs
sont inclus pour filtrer l'historique ; aucun journal d'une autre organisation n'est
retourné. En l'absence de référentiel configuré, la page est vide.

Un code est unique par organisation. Ce ticket ajoute le stockage et la lecture ; il
n'ajoute ni import de journaux (KAN-345), ni création manuelle, ni affectation en masse.

## Migration et preuve d'export

`V386__add_accounting_journals_and_entry_exports.sql` est déclaré dans les profils
`dev`, `staging` et `prod`, suivant l'initialisation SQL existante. Il crée le référentiel,
les liens facultatifs `accounting_entries.accounting_journal_id` et `export_batch_id`,
leurs clés étrangères et leurs index. Les références JPA sont également contrôlées
avant écriture pour appartenir à l'organisation de la facture.

Aucun journal n'est créé ou affecté automatiquement. La reprise des exports historiques
se limite à l'unique écriture originale `GENERATED` sans parent d'une facture reliée à
un lot `GENERE` ou `ARCHIVE` de la même organisation : c'est la sélection utilisée par
l'ancien exporteur. Les extournes, correctives, originaux ambigus et lots incomplets ou
étrangers ne sont pas repris. Un statut de facture seul ne constitue jamais une preuve.
`NOT_EXPORTED` signifie donc absence de preuve portée par cette écriture, y compris
pour un historique ambigu qui nécessite une vérification des données.

Le script peut être rejoué et préserve les liens déjà renseignés. Pour les nouveaux
exports CSV/FEC, chaque écriture réellement incluse reçoit son lien vers le lot dans la
transaction d'export existante. Un échec annule ce lien avec les autres changements.
L'archivage ultérieur du lot conserve la preuve d'export.
