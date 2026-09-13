# Backend Spring Boot

Le backend est une application Spring Boot Java 25 situee dans `backend/`.

## Build Docker

Deux Dockerfiles sont disponibles:

| Fichier | Usage |
| --- | --- |
| `backend/Dockerfile.dev` | Developpement avec Maven dans le conteneur |
| `backend/Dockerfile` | Build multi-stage et runtime Java 25 optimise |

Le Dockerfile de production:

1. utilise Maven avec Eclipse Temurin 25 pour compiler le jar;
2. copie le jar dans une image `eclipse-temurin:25-jre-alpine`;
3. execute l'application avec un utilisateur non-root.

## Profils

| Profil | Datasource | OCR | Stockage |
| --- | --- | --- | --- |
| default | H2 memoire | Mock | Local |
| dev | PostgreSQL Docker | FastAPI | MinIO |
| staging | PostgreSQL Docker | FastAPI | MinIO |
| prod | PostgreSQL Docker | FastAPI | MinIO |

Fichiers:

```text
backend/src/main/resources/application.yml
backend/src/main/resources/application-dev.yml
backend/src/main/resources/application-staging.yml
backend/src/main/resources/application-prod.yml
```

## Variables Utilisees Par Docker

```text
SPRING_PROFILES_ACTIVE
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
APP_OCR_MOCK
APP_OCR_BASE_URL
APP_STORAGE_TYPE
APP_STORAGE_S3_ENDPOINT
APP_STORAGE_S3_ACCESS_KEY
APP_STORAGE_S3_SECRET_KEY
APP_STORAGE_S3_BUCKET
```

## OCR Client

Deux implementations existent:

| Classe | Condition |
| --- | --- |
| `MockOcrClient` | `app.ocr.mock=true` |
| `FastApiOcrClient` | `app.ocr.mock=false` |

En Docker, `APP_OCR_MOCK=false` et le backend appelle:

```text
http://ocr:8000/ocr/analyze
```

## Endpoint Plans D'Abonnement

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/subscription-plans` | Retourne aux utilisateurs authentifies les plans SaaS actifs avec leurs limites et leurs fonctionnalites. Une limite `null` signifie que l'usage est illimite. |

## Endpoints Factures MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `POST` | `/api/v1/customer-invoices` | Cree une facture client au statut `BROUILLON` pour un client de l'organisation courante. La devise est obligatoire et validee comme code ISO 4217; les dates, la reference de commande et la description sont facultatives. Aucun numero de facture n'est attribue. |
| `PATCH` | `/api/v1/customer-invoices/{id}` | Modifie le client, la devise ou les informations principales tant que la facture client reste au statut `BROUILLON`, sans lui attribuer de numero. |
| `POST` | `/api/v1/invoices/upload` | Upload, OCR et sauvegarde de la facture |
| `PATCH` | `/api/v1/invoices/{id}` | Corrige les donnees extraites, conserve les valeurs OCR brutes, marque les champs OCR corriges manuellement et journalise chaque valeur avant/apres. Une facture `REJETEE` redevient `EXTRAITE` et doit etre soumise explicitement. |
| `PATCH` | `/api/v1/invoices/{id}/assignee` | Affecte ou reaffecte la facture a un utilisateur actif de l'organisation courante, ou retire l'affectation avec `userId: null`, puis journalise l'ancien affectataire, le nouveau et l'auteur. |
| `POST` | `/api/v1/invoices/{id}/submit-for-validation` | Controle la completude et la coherence `HT + TVA = TTC`, soumet une facture `EXTRAITE` a validation et historise l'action. Un ecart superieur a `0,01` retourne `409 INVOICE_AMOUNTS_INCONSISTENT` avec le TTC attendu, le TTC recu, l'ecart et la tolerance. |
| `POST` | `/api/v1/invoices/{id}/validate` | Valide une facture `A_VERIFIER` et historise la decision, son auteur et sa date |
| `POST` | `/api/v1/invoices/{id}/request-correction` | Demande une correction motivee sur une facture `A_VERIFIER`, la replace en `EXTRAITE` et historise la decision |
| `POST` | `/api/v1/invoices/{id}/reject` | Refuse une facture eligible avec un motif obligatoire et historise la decision, son auteur et sa date |
| `POST` | `/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision` | Ignore une alerte en attente, confirme le doublon ou rejette la facture, puis met a jour son workflow |
| `POST` | `/api/v1/invoices/{id}/accounting-entry` | Genere ou controle l'ecriture comptable apres validation. Une ecriture desequilibree retourne `409` avec les totaux et l'ecart, et la facture reste `VALIDEE`. |
| `POST` | `/api/v1/accounting-exports/csv?startDate=2026-08-01&endDate=2026-08-31` | Controle toutes les factures de l'organisation courante et de la periode optionnelle avant de generer le CSV. Si une ou plusieurs regles echouent, la reponse `409` regroupe toutes les erreurs par facture (`invoiceId`, `invoiceNumber`, code et message) sans creer de lot ni modifier les statuts. Chaque tentative est journalisee avec son auteur, sa date, le format, le perimetre, les factures concernees et son resultat. Apres succes, les ecritures recoivent des numeros de piece numeriques ordonnes selon la sequence de l'organisation, un lot `CSV` passe de `PREPARATION` a `GENERE` et les factures passent `EXPORTEE`. |
| `POST` | `/api/v1/accounting-exports/fec?startDate=2026-08-01&endDate=2026-08-31` | Applique les controles d'export et les controles propres au FEC, puis genere un fichier texte UTF-8 a 18 colonnes separees par des tabulations. Les dates utilisent `yyyyMMdd`, les montants ont deux decimales et le nom suit `{SIREN}FEC{dateFin}.txt`. Chaque tentative est journalisee avec son auteur, sa date, le format, le perimetre, les factures concernees et son resultat. Un controle invalide retourne le meme rapport `409` sans creer de lot ni modifier les factures. |
| `GET` | `/api/v1/accounting-exports` | Historique de l'organisation : `query` (nom du fichier ou identifiant exact), `status` (`PREPARATION`, `GENERE`, `ARCHIVE`), `format` (`CSV`, `FEC`), `startDate`/`endDate` (dates inclusives de creation), `page` (base zero), `size` (1-100, defaut 8). Tri date de creation puis identifiant decroissants. Metadonnees publiques, auteur, nombre de factures et montants TTC par devise ; aucun chemin de stockage. |
| `GET` | `/api/v1/accounting-exports/summary` | Factures pretes et factures bloquees par les controles comptables, toutes periodes confondues ; nombre de lots generes dans le mois courant du serveur, y compris ceux archives ensuite. `monthStart`/`monthEnd` explicitent ce mois. Les factures bloquees ne sont pas un historique des tentatives de generation echouees. |
| `GET` | `/api/v1/accounting-exports/selection?startDate=2026-08-01&endDate=2026-08-31` | Candidats `EXPORTABLE` sans lot, dans l'organisation courante et la periode inclusive optionnelle. Reutilise les controles comptables communs ; retourne eligibilite et erreurs par facture, montants debit/credit des seules lignes eligibles et totaux separes par devise. La liste complete est retournee pour le MVP et peut etre paginee dans l'interface. |
| `POST` | `/api/v1/accounting-exports/selection/confirm` | Corps JSON : `startDate`, `endDate` optionnelles et `invoiceIds` non vide, positifs et uniques. Recontrole uniquement cette selection dans l'organisation et la periode courantes. Retourne les factures et totaux verifies ; `400` pour une requete invalide, `409` si une facture est indisponible ou echoue aux controles. Ne cree aucun lot, numero de piece, fichier ni evenement metier et ne change aucun statut. Cette preparation non persistante ne reserve pas les factures : la generation revalide exactement ces identifiants et applique les controles du format choisi. |
| `GET` | `/api/v1/accounting-exports/formats` | Liste des formats implementes par les generateurs : `["CSV", "FEC"]`. Aucun modele de logiciel comptable ou preference d'organisation n'est simule. Permission `EXPORT_ACCOUNTING`. |
| `POST` | `/api/v1/accounting-exports/preflight` | Corps JSON : `invoiceIds` non vide, positifs et uniques, `format` obligatoire (`CSV` ou `FEC`), `startDate`/`endDate` facultatives et inclusives. Recontrole uniquement les factures selectionnees de l'organisation courante, encore `EXPORTABLE` et sans lot, avec les controles communs et ceux propres au FEC si choisi. Succes : `{format, selection}` ; `selection` contient organisation, periode, factures et totaux par devise, comme `/selection/confirm`. `400` si la requete est invalide ; `409 ACCOUNTING_EXPORT_VALIDATION_FAILED` avec `invoices[].invoiceId`, `invoiceNumber`, `errors[].code/message` si un controle echoue. Une facture indisponible produit `SELECTION_CHANGED` sans reveler son identite. Lecture seule : aucun fichier, lot, numero de piece, statut ou audit modifie. La selection n'est ni persistee ni reservee ; la generation doit refaire les controles sur ces memes identifiants. Permission `EXPORT_ACCOUNTING`. |
| `POST` | `/api/v1/accounting-exports/generate` | Meme corps que `/preflight`. Sous verrou de sequence de l'organisation, revalide exactement les identifiants choisis et les controles CSV/FEC, genere et stocke le fichier puis passe les factures a `EXPORTEE`. Succes `200` apres commit : `{exportBatchId, organizationId, format, status: "GENERE", fileName, fileSize, generatedAt, createdByName, invoiceIds}` ; aucun chemin de stockage expose. Telechargement via `GET /{id}/file`. `400` requete invalide ; `409` selection perimee/deja exportee ou controles en echec ; `401/403` acces refuse. Les soumissions concurrentes sont serialisees : une selection deja exportee ne cree pas de nouveau lot. Rollback des statuts, liens et numeros en cas d'echec ; suppression compensatoire du fichier nouvellement stocke (erreur de suppression journalisee) et audit d'echec. Aucun pourcentage d'avancement ni rapport annexe ; une reponse reseau perdue doit etre reconciliee avec l'historique avant une nouvelle tentative. Permission `EXPORT_ACCOUNTING`. |
| `POST` | `/api/v1/invoices/{id}/mark-paid` | Confirme le reglement d'une facture `EXPORTEE` avec une `paymentDate` obligatoire et une `paymentReference` facultative, enregistre l'utilisateur connecte, passe la facture au statut `PAYEE` et historise l'action. Une nouvelle demande sur une facture deja `PAYEE` reste sans effet et ne duplique pas l'historique. |
| `POST` | `/api/v1/invoices/{id}/archive` | Archive une facture au statut `EXPORTEE`, enregistre `archivedAt`, passe la facture au statut `ARCHIVEE` et historise l'action. |
| `DELETE` | `/api/v1/invoices/{id}` | Suppression administrative reservee au role `ADMIN`, avec un corps `{\"reason\": \"...\"}` obligatoire. Seuls les statuts anterieurs a la validation (`DEPOSEE`, `OCR_EN_COURS`, `ERREUR_OCR`, `EXTRAITE`, `A_VERIFIER`, `REJETEE`, `BROUILLON`) sont acceptes. |
| `GET` | `/api/v1/invoices?status=EXTRAITE&status=VALIDEE&invoiceNumber=FAC-2026&supplier=Orange&client=Docomptia&dueDate=2026-08-31&startDate=2026-08-01&endDate=2026-08-31&minAmount=100.00&maxAmount=500.00&page=0&size=20&sortBy=invoiceDate&direction=DESC` | Recherche les factures de l'organisation courante, filtre par un ou plusieurs statuts connus (parametre repete ou codes separes par des virgules), le numero exact ou partiel, le fournisseur ou client par nom ou identifiant, la date de facture, la date d'echeance, une periode inclusive de dates de facture ou une plage inclusive de montants TTC, puis retourne une page triable par date, montant TTC ou statut. Un statut inconnu retourne `400`. Les bornes de periode et de montant peuvent etre omises individuellement; une borne minimum posterieure a la borne maximum correspondante retourne `400`. |
| `GET` | `/api/v1/invoices/pending-validation?page=0&size=20&sortBy=invoiceDate&direction=DESC` | Retourne au responsable comptable une page triable des seules factures `A_VERIFIER` de son organisation. |
| `GET` | `/api/v1/invoices/assigned-to-me?status=EXTRAITE&status=A_VERIFIER&page=0&size=20&sortBy=invoiceDate&direction=DESC` | Retourne une page triable des factures affectees a l'utilisateur connecte dans son organisation, avec un filtre optionnel sur un ou plusieurs statuts connus. |
| `GET` | `/api/v1/invoices/{id}` | Retourne la facture, l'OCR, l'ecriture d'origine si elle existe, toutes les ecritures liees dans l'ordre chronologique et l'historique des actions utiles a la fiche. Les identifiants `reversedAccountingEntryId` relient l'extourne a l'originale puis l'ecriture corrective a l'extourne. |
| `GET` | `/api/v1/dashboard/anomalies?includeResolved=false` | Liste les anomalies metier de l'organisation courante avec leur code stable, libelle, description et etat bloquant. Par defaut, seules les anomalies non resolues sont retournees. |
| `PATCH` | `/api/v1/invoices/{invoiceId}/anomalies/{anomalyId}/resolve` | Resout une anomalie de la facture dans l'organisation courante. L'operation est idempotente et l'anomalie ne reste plus bloquante. |
| `GET` | `/api/v1/invoices/{id}/file` | Telecharge le fichier original si la facture appartient a l'organisation courante |
| `GET` | `/api/v1/invoices/{id}/preview` | Retourne le PDF ou l'image originale avec une disposition `inline` et son type MIME si la facture appartient a l'organisation courante. Un format non previsualisable retourne `415`. |
| `GET` | `/api/v1/invoices/{id}/history` | Retourne chronologiquement les changements de statut, corrections, affectations et decisions de l'organisation courante |
| `POST` | `/api/v1/invoices/{id}/comments` | Ajoute un commentaire non vide a une facture de l'organisation courante avec l'utilisateur connecte comme auteur et l'integre a son historique |
| `GET` | `/api/v1/invoices/{id}/comments?page=0&size=20` | Retourne une page de commentaires de l'organisation courante, du plus ancien au plus recent, avec leur auteur et leur date |
| `PATCH` | `/api/v1/accounting-entries/{entryId}/lines/{lineId}` | Corrige le compte, le libelle, le debit ou le credit d'une ligne non exportee et historise les valeurs avant/apres |
| `POST` | `/api/v1/accounting-entries/{entryId}/reversal` | Cree l'extourne d'une ecriture exportee sous la forme d'une nouvelle ecriture datee, liee a l'originale, dont les debits et credits sont inverses. L'action, son auteur, sa date et les identifiants des ecritures originale et d'extourne sont journalises dans l'historique en lecture seule de la facture. |
| `POST` | `/api/v1/accounting-entries/{entryId}/corrective-entry` | Cree l'extourne si elle n'existe pas encore, puis une ecriture corrective datee reprenant les comptes et montants de l'ecriture d'origine. Une nouvelle demande retourne la meme ecriture corrective sans la dupliquer. |
| `GET` | `/api/v1/notifications?unreadOnly=false&page=0&size=20` | Retourne les notifications de l'utilisateur connecte, de la plus recente a la plus ancienne. `unreadOnly=true` limite la page aux notifications non lues. Chaque notification indique avec `emailRequired` si un email est prepare et expose alors `emailRecipient`, `emailSubject` et `emailBody`. |
| `PATCH` | `/api/v1/notifications/{id}/read` | Marque comme lue une notification de l'utilisateur connecte et enregistre la date de premiere lecture. Les lectures suivantes conservent cette date. Une notification d'un autre utilisateur retourne `404`. |

Les notifications d'erreur OCR, de demande de correction, de refus et d'attente de validation
preparent les donnees necessaires a un futur canal email lorsque le destinataire possede une
adresse. Cette preparation ne realise aucun envoi: la notification interne est conservee meme
si les donnees email ne peuvent pas etre preparees.

Les reponses d'ecriture exposent `totalDebit`, `totalCredit`, `balanceDifference` et `balanced`.
La [lecture des écritures et journaux](accounting-entry-read-api.md) documente les filtres,
le tri, les diagnostics structurés et la preuve d'export propre à chaque écriture (KAN-386).
La [saisie des lignes comptables](accounting-entry-line-api.md) décrit les ajouts/retraits,
la TVA, les affectations analytiques et les protections de concurrence (KAN-387).
La [création manuelle d’une écriture](accounting-entry-create-api.md) décrit les factures
éligibles, l’enregistrement atomique et les conflits avec une originale existante (KAN-388).
Une correction desequilibree retire le statut `EXPORTABLE`; le statut est retabli lorsque
l'equilibre est corrige.

Le endpoint `PATCH /api/v1/invoices/{id}` retourne `400` avec un message explicite si
le payload est invalide ou n'applique aucune modification effective, et `409` si
le statut courant interdit la correction. Une facture hors de l'organisation courante
retourne `404`.

Une facture `EXPORTEE` et son ecriture ne sont plus modifiables directement. Les routes de
correction de facture, classement, affectation, doublon et commentaire retournent `409` avec le
code metier `EXPORTED_INVOICE_NOT_MODIFIABLE`. La correction d'une ligne comptable conserve le
code `ACCOUNTING_ENTRY_NOT_MODIFIABLE`; une correction apres export doit passer par une extourne.

Dans les reponses OCR, `ocrAnalysis.fields[].corrected` vaut `true` lorsqu'une
valeur normalisee provient d'une correction manuelle.

La fiche d'une facture expose `paymentDate`, `paymentReference` et `paidByUserId`
lorsqu'un reglement a ete confirme, ainsi que `archivedAt` lorsqu'elle a ete archivee.
Pour un document archive, `legalRetentionMetadata` expose en lecture seule le fichier lie,
la date d'archivage, la duree de conservation en annees, l'emplacement et l'etat d'integrite
`VERIFIED`, `ANOMALY_DETECTED` ou `NOT_VERIFIED`. La duree vaut 10 ans par defaut et se configure
avec `app.legal-retention.duration-years`.

L'historique en lecture seule d'une facture expose les changements de statut `PAYEE` et
`ARCHIVEE`, ainsi que l'action comptable `ACCOUNTING_ENTRY_REVERSED`. Ces traces indiquent
l'auteur et la date de l'action; la trace d'extourne relie egalement les identifiants des
ecritures originale et inverse.

Une facture `ARCHIVEE` reste consultable, previsualisable et telechargeable. Toute route
qui modifierait la facture, son statut, son classement, son affectation, ses doublons, ses
commentaires ou son ecriture retourne `409` avec le code metier
`ARCHIVED_INVOICE_NOT_MODIFIABLE`. Les commentaires deja presents restent consultables.

## Matrice Des Permissions MVP

Le backend centralise les autorisations dans `BusinessPermission`. Toute nouvelle route
metier doit etre rattachee explicitement a une permission; une route non declaree est refusee
par defaut.

| Permission | Actions concernees | `ADMIN` | `OPERATEUR_COMPTABLE` | `RESPONSABLE_COMPTABLE` |
| --- | --- | --- | --- | --- |
| `VIEW_OWN_PROFILE` | Consulter son profil | Oui | Oui | Oui |
| `VIEW_REFERENCE_DATA` | Consulter les referentiels frontend | Oui | Oui | Oui |
| `VIEW_SUBSCRIPTION_PLANS` | Consulter les offres SaaS actives | Oui | Oui | Oui |
| `VIEW_ORGANIZATION` | Consulter l'organisation courante | Oui | Oui | Oui |
| `MANAGE_ORGANIZATION` | Modifier les informations legales de l'organisation | Oui | Non | Non |
| `VIEW_INVOICES` | Rechercher, consulter, telecharger une facture et son historique | Oui | Oui | Oui |
| `COMMENT_INVOICES` | Ajouter un commentaire sur une facture | Oui | Oui | Oui |
| `VIEW_DASHBOARD` | Consulter la synthese du dashboard de l'organisation | Oui | Oui | Oui |
| `VIEW_NOTIFICATIONS` | Consulter ses propres notifications | Oui | Oui | Oui |
| `PROCESS_INVOICES` | Deposer, corriger, relancer l'OCR, soumettre et traiter un doublon | Oui | Oui | Non |
| `VALIDATE_INVOICES` | Valider, refuser ou demander une correction | Non | Non | Oui |
| `MANAGE_ACCOUNTING_ENTRIES` | Generer une ecriture et corriger ses lignes | Oui | Oui | Oui |
| `EXPORT_ACCOUNTING` | Consulter les exports, preparer une selection, generer et telecharger les exports comptables | Oui | Oui | Oui |
| `CONFIRM_INVOICE_PAYMENTS` | Confirmer le reglement d'une facture exportee | Oui | Oui | Oui |
| `ARCHIVE_INVOICES` | Archiver une facture exportee | Oui | Oui | Oui |
| `VIEW_SUPPLIERS` | Lister et consulter les fournisseurs | Oui | Oui | Oui |
| `MANAGE_SUPPLIERS` | Modifier un fournisseur | Oui | Oui | Non |
| `VIEW_CUSTOMERS` | Lister et consulter les clients | Oui | Oui | Oui |
| `MANAGE_CUSTOMERS` | Creer, modifier ou desactiver un client | Oui | Oui | Non |
| `VIEW_ACCOUNTING_CONFIGURATION` | Consulter le plan et les regles comptables | Oui | Oui | Oui |
| `MANAGE_ACCOUNTING_CONFIGURATION` | Creer, modifier ou desactiver un compte et modifier une regle | Oui | Non | Non |
| `MANAGE_USERS` | Inviter ou modifier un utilisateur dans l'organisation | Oui | Non | Non |

## Endpoint Dashboard MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/dashboard/summary?startDate=2026-08-01&endDate=2026-08-31&actionLimit=10` | Retourne les volumes et montants, la repartition par statut, les files de travail, les alertes et les factures necessitant une action de l'organisation courante. Les bornes optionnelles filtrent inclusivement la date de facture. |

Une periode dont la date de debut est posterieure a la date de fin retourne `400`. Les alertes de
doublon comptent les factures ayant au moins une alerte en attente; les ecritures desequilibrees
sont comptees une fois par ecriture.
Les factures necessitant une action sont triees de la plus recemment modifiee a la plus ancienne.
`actionLimit` vaut 10 par defaut et accepte une valeur comprise entre 1 et 100. Chaque facture
indique `CORRIGER`, `VERIFIER`, `VALIDER` ou `DEBLOQUER` dans `requiredAction` selon son statut.

## Endpoint Referentiels MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/reference-data` | Retourne aux utilisateurs authentifies les statuts de facture, roles MVP, devises ISO 4217 et formats de fichier acceptes avec leur code et leur libelle |

La reponse exclut les identifiants techniques, descriptions internes, permissions et details de
validation des fichiers. Les formats retournes correspondent aux formats controles lors de
l'upload d'une facture.

## Endpoint Organisation MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/organizations/current` | Retourne les informations legales, de contact et la devise par defaut de l'organisation de l'utilisateur connecte |
| `GET` | `/api/v1/organizations/current/subscription` | Retourne a l'administrateur le statut, la prochaine echeance, le plan courant, ses limites, ses fonctionnalites et la consommation de l'organisation. `subscribed=false` et les autres champs `null` indiquent l'absence d'abonnement. |
| `PATCH` | `/api/v1/organizations/current/subscription` | Change l'offre de l'organisation. Corps: `{\"planCode\": \"BUSINESS\"}`. Un upgrade est immediat; un downgrade compatible avec la consommation courante est planifie a la prochaine echeance. |
| `PATCH` | `/api/v1/organizations/current` | Modifie les informations legales, de contact et la devise par defaut de l'organisation de l'administrateur connecte |
| `GET` | `/api/v1/organizations/current/onboarding` | Retourne a l'administrateur la progression de la configuration initiale, les etapes terminees et les actions restantes |
| `GET` | `/api/v1/organizations/current/validation-preferences` | Retourne si le circuit de validation est actif et son seuil TTC optionnel |
| `PATCH` | `/api/v1/organizations/current/validation-preferences` | Modifie les preferences de validation de l'organisation courante |

La route ne prend aucun identifiant d'organisation afin d'empecher la consultation d'une autre
organisation. La modification accepte `name`, `legalName`, `siret`, `email`, `phone`, `address` et
`defaultCurrencyCode`. La devise est normalisee et validee comme code ISO 4217 reconnu; elle est
utilisee par les nouvelles factures de l'organisation. La modification
retourne `400` si une valeur est invalide ou inchangee et `409` si le SIRET est deja utilise par
une autre organisation. Chaque champ modifie est journalise avec sa valeur avant/apres et
l'administrateur responsable.

La consommation expose le nombre courant d'utilisateurs actifs et le nombre de factures creees
pendant le mois calendaire courant. Les bornes `periodStart` et `periodEnd` rendent la periode
explicite; le calcul recommence automatiquement au changement de mois.

La creation d'une facture fournisseur ou client est refusee lorsque la consommation mensuelle
atteint la limite du plan. L'activation d'un utilisateur est refusee lorsque le nombre
d'utilisateurs actifs atteint sa limite. Ces refus retournent `409` avec le code
`SUBSCRIPTION_LIMIT_REACHED`, la limite concernee, le quota et la consommation, sans creer de
donnee partielle. La reponse propose aussi les plans actifs compatibles autres que le plan courant,
avec leurs limites ameliorees et leurs fonctionnalites ajoutees. Une proposition permet l'action
bloquee et ne diminue aucune limite ni fonctionnalite actuelle; elle ne modifie jamais l'abonnement.
Une limite `null` reste illimitee.

Chaque changement d'offre clot la periode du plan precedent et cree une nouvelle periode datee.
Un downgrade qui depasse une limite du plan cible retourne `409` sans modifier l'abonnement.

L'avancement de l'onboarding est recalcule a chaque consultation a partir des informations de
l'organisation, de la devise par defaut et de la presence d'au moins un compte comptable actif.

Par defaut, toutes les factures doivent etre validees. Un administrateur peut desactiver la
validation ou definir un `validationThreshold` strictement positif avec au plus deux decimales.
Dans ce dernier cas, les factures dont le montant TTC est inferieur au seuil sont validees
directement lors de leur soumission; les autres passent au statut `A_VERIFIER`. Un seuil est
refuse lorsque `validationRequired` vaut `false`.

## Endpoints Fournisseurs MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/suppliers?query=orange&page=0&size=20` | Recherche une page de fournisseurs par raison sociale, nom commercial ou identifiant legal normalise dans l'organisation courante |
| `GET` | `/api/v1/suppliers/{id}` | Retourne le detail d'un fournisseur de l'organisation courante |
| `PATCH` | `/api/v1/suppliers/{id}` | Modifie la raison sociale, le nom commercial et les informations de contact d'un fournisseur de l'organisation courante, sans ecraser directement ses identifiants legaux |
| `PATCH` | `/api/v1/suppliers/{supplierId}/legal-identifiers/{identifierId}` | Clot un identifiant legal courant et cree son remplacement historise avec auteur, date et motif |

Le detail expose les identifiants courants et leur historique. Un fournisseur absent ou rattache a une autre organisation retourne `404`. La modification
retourne `400` si elle tente d'ecraser directement un identifiant legal. Le remplacement d'un identifiant applique les controles francais uniquement pour
les schemas et pays francais et retourne `409` lorsqu'un identifiant actif est deja utilise par un autre fournisseur de l'organisation courante.

## Endpoints Plan Comptable MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `POST` | `/api/v1/chart-of-accounts` | Cree un compte actif dans l'organisation courante |
| `GET` | `/api/v1/chart-of-accounts?page=0&size=20` | Retourne une page de comptes de l'organisation courante |
| `GET` | `/api/v1/chart-of-accounts/{id}` | Retourne le detail d'un compte de l'organisation courante |
| `PATCH` | `/api/v1/chart-of-accounts/{id}` | Modifie le numero, le libelle ou le type d'un compte |
| `POST` | `/api/v1/chart-of-accounts/{id}/deactivate` | Desactive un compte sans le supprimer |

Un numero de compte est unique dans une organisation. Un compte absent ou rattache a une autre
organisation retourne `404`; un numero deja utilise retourne `409`. La desactivation conserve les
regles et lignes comptables qui referencent le compte.

Les comptes de tiers fournisseurs sont distincts du plan comptable general. Chaque compte porte un
code unique dans son organisation et reference un compte collectif actif de classe 4 du plan
comptable de cette meme organisation. Le rattachement a un fournisseur est facultatif afin de
permettre l'import avant rapprochement; lorsqu'il existe, le fournisseur appartient a la meme
organisation. Les comptes de tiers desactives restent persistés pour l'historique mais sont exclus
des recherches de comptes actifs utilisees pour proposer de nouvelles ecritures.

Lors de la generation d'une ecriture fournisseur, la ligne de dette utilise le compte de tiers actif
rattache au fournisseur et son compte collectif. En l'absence de compte de tiers actif, y compris si
le compte rattache est desactive, le compte fournisseur de la regle comptable est utilise sans compte
auxiliaire. Si ce compte de fallback est absent, inactif ou hors de l'organisation, la generation est
bloquee avec le prerequis `supplierAccount`. Le CSV conserve ses colonnes existantes et le FEC renseigne
`CompAuxNum` et `CompAuxLib` seulement lorsqu'un compte de tiers a ete retenu.

L'[import CSV du plan comptable](account-import-api.md) propose trois POST multipart
`/api/v1/chart-of-accounts/import/inspect`, `/preview` et `/confirm`, réservés à
l'administrateur. L'inspection et la prévisualisation n'écrivent aucun compte ;
la confirmation crée uniquement les nouveaux comptes valides sans écraser les existants.

## Endpoints Clients MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `POST` | `/api/v1/customers` | Cree un client actif dans l'organisation courante |
| `GET` | `/api/v1/customers?page=0&size=20` | Retourne une page des clients de l'organisation courante |
| `GET` | `/api/v1/customers/{id}` | Retourne le detail d'un client de l'organisation courante |
| `PATCH` | `/api/v1/customers/{id}` | Modifie les informations legales et de contact d'un client de l'organisation courante |
| `POST` | `/api/v1/customers/{id}/deactivate` | Desactive un client sans le supprimer |

Le SIRET et le numero de TVA sont normalises et uniques dans l'organisation. Les identifiants
francais sont controles et doivent correspondre lorsqu'ils sont renseignes ensemble. Un client
d'une autre organisation retourne `404`; la desactivation conserve la ligne pour l'historique.

## Endpoints Classement MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `POST` | `/api/v1/classifications` | Cree un dossier, classeur ou chantier actif dans l'organisation courante |
| `GET` | `/api/v1/classifications?type=CHANTIER&page=0&size=20` | Liste les elements, avec un filtre de type optionnel |
| `GET` | `/api/v1/classifications/{id}` | Consulte un element de l'organisation courante |
| `PATCH` | `/api/v1/classifications/{id}` | Modifie son nom ou sa description |
| `POST` | `/api/v1/classifications/{id}/deactivate` | Desactive l'element sans supprimer ses rattachements |
| `PATCH` | `/api/v1/invoices/{id}/classification` | Rattache une facture a un element actif de la meme organisation |

Les types autorises sont `DOSSIER`, `CLASSEUR` et `CHANTIER`. La consultation est ouverte aux
trois roles MVP, l'administration est reservee aux administrateurs et le rattachement suit la
permission de traitement des factures.

## Endpoints Utilisateurs MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/users?page=0&size=20&sortBy=lastName&direction=ASC` | Retourne aux administrateurs une page d'utilisateurs de l'organisation courante avec leur role et leur etat |
| `POST` | `/api/v1/users` | Invite un utilisateur inactif dans l'organisation de l'administrateur avec son identite, son email unique et un role MVP autorise |
| `PATCH` | `/api/v1/users/{id}/status` | Active ou desactive un utilisateur de l'organisation courante et historise le changement |
| `PATCH` | `/api/v1/users/{id}/role` | Remplace le role d'un utilisateur de l'organisation courante par un role MVP autorise et historise le changement |
| `PATCH` | `/api/v1/users/{id}` | Modifie le prenom, le nom ou l'email d'un utilisateur de l'organisation courante |
| `GET` | `/api/v1/roles` | Retourne aux administrateurs les roles MVP attribuables avec leur code et leur libelle |

Une invitation normalise l'email en minuscules et retourne `409` lorsqu'il est deja utilise,
y compris avec une casse differente. Le compte invite reste initialement inactif. Un utilisateur
desactive ne peut ni se connecter ni reutiliser un JWT existant sur une route securisee.
La modification normalise egalement l'email en minuscules, preserve son unicite et retourne
`404` lorsqu'un utilisateur appartient a une autre organisation.
La desactivation ou le changement de role du dernier administrateur actif est refuse avec un
conflit `LAST_ACTIVE_ADMINISTRATOR`; l'operation reste autorisee si un autre administrateur actif
existe dans l'organisation.
Chaque changement effectif de role ou de statut ajoute un journal d'audit avec l'ancienne valeur,
la nouvelle valeur, l'administrateur responsable et la date. Ces journaux ne sont exposes par
aucun endpoint de modification.

## Endpoint D'Inscription MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Cree en une transaction une organisation et son premier utilisateur actif avec le role `ADMIN` |

L'inscription est publique. Elle normalise l'email de l'administrateur en minuscules, chiffre
son mot de passe avec BCrypt et utilise cet email comme contact initial de l'organisation. Un
email utilisateur ou un SIRET d'organisation deja utilise retourne `409`; une erreur de creation
de l'administrateur annule egalement la creation de l'organisation.

## Stockage Des Fichiers

La suppression administrative est logique : la facture est exclue des lectures de factures,
mais sa ligne, son fichier original et ses relations restent conserves. La date, l'administrateur
et le motif sont enregistres sur la facture et dans le journal d'audit avec l'action
`ADMINISTRATIVELY_DELETED`. Cette strategie evite toute rupture des pieces, ecritures et historiques
associes ; une facture validee, comptabilisee, exportable, exportee, payee ou archivee est refusee.

Deux implementations existent:

| Classe | Condition |
| --- | --- |
| `LocalInvoiceFileStorageService` | `app.storage.type=local` |
| `MinioInvoiceFileStorageService` | `app.storage.type=s3` |

En Docker, les fichiers sont stockes dans MinIO et le chemin sauvegarde en base suit ce format:

```text
s3://invoice-files/invoices/{invoiceId}/{uuid}-{filename}
```

## Tests

Lancer les tests backend via Docker:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  run --rm --no-deps \
  -e SPRING_PROFILES_ACTIVE= \
  backend \
  mvn test \
  -Dspring.datasource.url=jdbc:h2:mem:facturation \
  -Dspring.datasource.driver-class-name=org.h2.Driver \
  -Dspring.datasource.username=sa \
  -Dspring.datasource.password= \
  -Dspring.jpa.hibernate.ddl-auto=create-drop \
  -Dapp.ocr.mock=true \
  -Dapp.storage.type=local
```

## Note Production

`ddl-auto=update` est configure dans les profils Docker pour accelerer le MVP. Pour une production stable, utiliser des migrations versionnees et changer le comportement Hibernate.
