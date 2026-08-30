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

## Endpoints Factures MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `POST` | `/api/v1/invoices/upload` | Upload, OCR et sauvegarde de la facture |
| `PATCH` | `/api/v1/invoices/{id}` | Corrige les donnees extraites, conserve les valeurs OCR brutes, marque les champs OCR corriges manuellement et journalise chaque valeur avant/apres. Une facture `REJETEE` redevient `EXTRAITE` et doit etre soumise explicitement. |
| `POST` | `/api/v1/invoices/{id}/submit-for-validation` | Controle la completude, soumet une facture `EXTRAITE` a validation et historise l'action |
| `POST` | `/api/v1/invoices/{id}/validate` | Valide une facture `A_VERIFIER` et historise la decision, son auteur et sa date |
| `POST` | `/api/v1/invoices/{id}/request-correction` | Demande une correction motivee sur une facture `A_VERIFIER`, la replace en `EXTRAITE` et historise la decision |
| `POST` | `/api/v1/invoices/{id}/reject` | Refuse une facture eligible avec un motif obligatoire et historise la decision, son auteur et sa date |
| `POST` | `/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision` | Ignore une alerte en attente, confirme le doublon ou rejette la facture, puis met a jour son workflow |
| `POST` | `/api/v1/invoices/{id}/accounting-entry` | Genere ou controle l'ecriture comptable apres validation. Une ecriture desequilibree retourne `409` avec les totaux et l'ecart, et la facture reste `VALIDEE`. |
| `GET` | `/api/v1/invoices?invoiceNumber=FAC-2026&supplier=Orange&client=Docomptia&page=0&size=20&sortBy=invoiceDate&direction=DESC` | Recherche les factures de l'organisation courante, filtre le numero exact ou partiel et le fournisseur ou client par nom ou identifiant, puis retourne une page triable par date, montant TTC ou statut. |
| `GET` | `/api/v1/invoices/{id}` | Retourne la facture, l'OCR et l'ecriture si elle existe |
| `GET` | `/api/v1/invoices/{id}/file` | Telecharge le fichier original si la facture appartient a l'organisation courante |
| `GET` | `/api/v1/invoices/{id}/history` | Retourne chronologiquement les changements de statut, corrections et decisions de doublon de l'organisation courante |
| `PATCH` | `/api/v1/accounting-entries/{entryId}/lines/{lineId}` | Corrige le compte, le libelle, le debit ou le credit d'une ligne non exportee et historise les valeurs avant/apres |

Les reponses d'ecriture exposent `totalDebit`, `totalCredit`, `balanceDifference` et `balanced`.
Une correction desequilibree retire le statut `EXPORTABLE`; le statut est retabli lorsque
l'equilibre est corrige.

Le endpoint `PATCH /api/v1/invoices/{id}` retourne `400` avec un message explicite si
le payload est invalide ou n'applique aucune modification effective, et `409` si
le statut courant interdit la correction. Une facture hors de l'organisation courante
retourne `404`.

Dans les reponses OCR, `ocrAnalysis.fields[].corrected` vaut `true` lorsqu'une
valeur normalisee provient d'une correction manuelle.

## Matrice Des Permissions MVP

Le backend centralise les autorisations dans `BusinessPermission`. Toute nouvelle route
metier doit etre rattachee explicitement a une permission; une route non declaree est refusee
par defaut.

| Permission | Actions concernees | `ADMIN` | `OPERATEUR_COMPTABLE` | `RESPONSABLE_COMPTABLE` |
| --- | --- | --- | --- | --- |
| `VIEW_OWN_PROFILE` | Consulter son profil | Oui | Oui | Oui |
| `VIEW_REFERENCE_DATA` | Consulter les referentiels frontend | Oui | Oui | Oui |
| `VIEW_ORGANIZATION` | Consulter l'organisation courante | Oui | Oui | Oui |
| `MANAGE_ORGANIZATION` | Modifier les informations legales de l'organisation | Oui | Non | Non |
| `VIEW_INVOICES` | Rechercher, consulter, telecharger une facture et son historique | Oui | Oui | Oui |
| `PROCESS_INVOICES` | Deposer, corriger, relancer l'OCR, soumettre et traiter un doublon | Oui | Oui | Non |
| `VALIDATE_INVOICES` | Valider, refuser ou demander une correction | Non | Non | Oui |
| `MANAGE_ACCOUNTING_ENTRIES` | Generer une ecriture et corriger ses lignes | Oui | Oui | Oui |
| `VIEW_SUPPLIERS` | Lister et consulter les fournisseurs | Oui | Oui | Oui |
| `MANAGE_SUPPLIERS` | Modifier un fournisseur | Oui | Oui | Non |
| `VIEW_ACCOUNTING_CONFIGURATION` | Consulter le plan et les regles comptables | Oui | Oui | Oui |
| `MANAGE_ACCOUNTING_CONFIGURATION` | Creer, modifier ou desactiver un compte et modifier une regle | Oui | Non | Non |
| `MANAGE_USERS` | Inviter ou modifier un utilisateur dans l'organisation | Oui | Non | Non |

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
| `GET` | `/api/v1/suppliers?page=0&size=20` | Retourne une page de fournisseurs de l'organisation courante |
| `GET` | `/api/v1/suppliers/{id}` | Retourne le detail d'un fournisseur de l'organisation courante |
| `PATCH` | `/api/v1/suppliers/{id}` | Modifie les informations legales et de contact d'un fournisseur de l'organisation courante |

Un fournisseur absent ou rattache a une autre organisation retourne `404`. La modification
retourne `400` pour un identifiant legal invalide et `409` lorsqu'un SIRET ou un numero de TVA
est deja utilise par un autre fournisseur de l'organisation courante.

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
