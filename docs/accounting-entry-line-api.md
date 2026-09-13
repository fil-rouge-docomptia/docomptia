# Saisie des lignes comptables — KAN-387

Ces opérations utilisent `MANAGE_ACCOUNTING_ENTRIES` et l'organisation de l'utilisateur
connecté. Elles complètent le [contrat de lecture KAN-386](accounting-entry-read-api.md).

## Opérations et réponse

| Méthode et URL | Réponse | En-têtes |
| --- | --- | --- |
| `POST /api/v1/accounting-entries/{entryId}/lines` | 201, écriture recalculée | `If-Match`, `Idempotency-Key` obligatoires |
| `PATCH /api/v1/accounting-entries/{entryId}/lines/{lineId}` | 200, écriture recalculée | Facultatifs pour conserver les anciens clients |
| `DELETE /api/v1/accounting-entries/{entryId}/lines/{lineId}` | 200, écriture recalculée | `If-Match`, `Idempotency-Key` obligatoires ; aucun corps |

POST et PATCH acceptent un objet JSON :

```json
{
  "accountId": 42,
  "lineLabel": "Fournitures du chantier",
  "debitAmount": 100.00,
  "creditAmount": 0.00,
  "vatRate": 20.00,
  "classificationId": 12
}
```

Les identifiants de cet exemple doivent être remplacés par ceux des référentiels réels.
En POST, les quatre premiers champs sont obligatoires. En PATCH, les champs absents
sont conservés ; au moins une valeur doit changer. `vatRate` et `classificationId`
acceptent `null` pour retirer explicitement leur valeur. Pour les quatre anciens
champs PATCH, `null` conserve le comportement précédent : aucune modification.

La réponse conserve les champs de `AccountingEntryResponse` (identifiant, nature,
numéro, date, totaux, différence, équilibre et lignes) et ajoute `version`,
`diagnostics`, `needsAttention` et `exportEligible`. Les lignes ajoutent `accountId`,
`vatRate` (chaîne décimale ou null), `classificationId`, `classificationName` et
`classificationType`. Les identifiants de ligne restent stables ; les numéros de lignes
survivantes ne sont pas renumérotés après retrait. Un ajout prend le maximum courant + 1.

Les lectures de facture et d'écriture restituent aussi la version et les nouvelles
données de ligne. Les diagnostics d'une lecture restent au niveau du contrat KAN-386 ;
les réponses de mutation les exposent directement avec l'écriture recalculée.

## Validation et références

- Compte actif de la même organisation ; libellé non vide de 255 caractères maximum.
- Débit et crédit non négatifs, au plus 10 chiffres entiers et deux décimales significatives.
  Les décimales supplémentaires non nulles sont refusées, sans arrondi silencieux.
- Débit et crédit simultanément positifs refusés. Zéro/zéro est autorisé comme brouillon,
  avec diagnostic bloquant `ACCOUNTING_LINE_AMOUNT_MISSING` jusqu'à correction ou retrait.
- TVA facultative, explicitement saisie de 0 à 100 avec deux décimales au plus. `null`
  signifie inconnue/non renseignée ; 0 est une valeur explicitement saisie. Il n'existe
  aucun référentiel de taux dans la branche de base : aucun taux fiscal ni menu de taux
  autorisés n'est inventé. Ce champ ne calcule ni les montants de ligne ni ceux de facture.
- Affectation facultative via le référentiel existant `/api/v1/classifications` :
  `DOSSIER`, `CLASSEUR` ou `CHANTIER`, actif et appartenant à l'organisation. Aucun
  nouveau type `PROJET` ni rattachement hérité automatiquement de la facture.

La copie d'une écriture en extourne/corrective conserve les données TVA et analytiques
explicitement enregistrées dans ses lignes. Un compte auxiliaire est conservé si le
compte général ne change pas ; un changement de compte général retire l'auxiliaire et
journalise aussi ce retrait.

## Éligibilité et immutabilité

Les diagnostics communs sont recalculés à partir des lignes persistées. Ils bloquent
notamment les montants invalides, les lignes zéro/zéro et les classifications devenues
inactives ou étrangères. Ces contrôles sont aussi exécutés avant export CSV/FEC.
Une écriture vide a des totaux zéro mais reste bloquée par `ACCOUNTING_LINES_MISSING`.
Le dernier retrait est permis pour permettre de reprendre la saisie.

Une originale `GENERATED` invalide repasse de `EXPORTABLE` à `VALIDEE` ; une correction
qui satisfait les contrôles communs permet le retour à `EXPORTABLE`. Aucun nombre fixe
ou minimal de trois lignes n'est imposé.

Les originales déjà exportées (lien d'export propre, lot de facture ou statut historique
`EXPORTEE`/`PAYEE`), les extournes et les factures archivées sont protégées. Toute écriture
avec un lot propre, même en préparation, est protégée. Les correctives sans lot sont
éditables indépendamment de l'état exporté de l'originale, sauf archivage de la facture.
Elles ne changent jamais le statut de la facture originale. Leur export reste prévu dans
KAN-390 ; `exportEligible` reste faux dans le workflow actuel.

## Concurrence et rejeu

La version est disponible dans `entry.version` sur la lecture KAN-386 et `version` sur
les réponses de saisie. Envoyer `If-Match: "3"` (ou `3`) pour modifier la version 3.
La version JPA augmente lorsque l'écriture change. Le frontend doit recharger après un
conflit ; remplacer automatiquement sa version sans faire relire les données écraserait
le travail d'un autre utilisateur.

Envoyer un UUID canonique dans `Idempotency-Key` et conserver **la même clé, la même
version et le même contenu** lors d'un retry. La clé est persistée par écriture avec une
empreinte de l'action, de la ligne, de l'auteur, de la version et des champs demandés.
Un rejeu exact ne modifie rien et ne duplique aucun audit ; il retourne l'état courant
de l'écriture, qui peut avoir évolué depuis le premier envoi. Une réutilisation avec un
autre contenu retourne 409. La preuve de requête reste valide après retrait de sa ligne.
La portée est l'écriture, pas l'ensemble de l'organisation.

Les mutations prennent le même verrou d'organisation que les exports CSV/FEC, puis
relisent l'écriture et la facture pour éviter une correction pendant leur export.
La version détecte aussi les conflits de persistance. Le PATCH historique sans en-tête
reste compatible mais ne peut pas détecter qu'un écran était déjà obsolète avant l'appel ;
les nouveaux clients doivent envoyer `If-Match` et `Idempotency-Key`. Une clé fournie
sans version est refusée. Les protections ne nécessitent aucun changement des anciens
endpoints d'export.

## Erreurs et audit

| HTTP | Code ou cause |
| --- | --- |
| 400 | `ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR` : champ invalide, compte/classification indisponible, montant, taux, en-tête mal formé ou PATCH sans changement |
| 400 | En-tête obligatoire absent ou corps JSON invalide, traité par Spring MVC |
| 401 / 403 | Authentification / permission manquante |
| 404 | `ACCOUNTING_ENTRY_NOT_FOUND` ou `ACCOUNTING_ENTRY_LINE_NOT_FOUND`, y compris ressources étrangères |
| 409 | `ACCOUNTING_ENTRY_NOT_MODIFIABLE` ou `ARCHIVED_INVOICE_NOT_MODIFIABLE` |
| 409 | `ACCOUNTING_ENTRY_MUTATION_CONFLICT` : version périmée, conflit JPA ou clé réutilisée différemment |

L'audit conserve l'auteur, l'organisation, la date, le champ, l'avant et l'après :
`LINE_CORRECTION`, `LINE_ADDED`, `LINE_REMOVED`. Les ajouts/retraits enregistrent
également l'identifiant de l'écriture et le numéro de ligne, pour garder une trace même
après suppression. Les actions sont consultables dans l'API d'audit existante. Lignes,
version, statuts, audits et preuve d'idempotence appartiennent à une seule transaction :
un échec annule l'ensemble.

## Migration

`V387__add_accounting_line_metadata_and_mutations.sql` est déclaré dans les profils
`dev`, `staging` et `prod` après V386. Il ajoute la version initiale 0, les métadonnées
facultatives et la table des requêtes exécutées avec unicité par écriture et clé.
Il ne change aucun montant existant, ne déduit aucune TVA/classification historique et
peut être rejoué sans écraser les valeurs saisies. Aucun changement frontend dans ce ticket.
