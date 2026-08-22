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
| `POST` | `/api/v1/invoices/{id}/accounting-entry` | Genere l'ecriture comptable apres validation |
| `GET` | `/api/v1/invoices/{id}` | Retourne la facture, l'OCR et l'ecriture si elle existe |
| `GET` | `/api/v1/invoices/{id}/history` | Retourne chronologiquement les changements de statut, corrections et decisions de doublon de l'organisation courante |

Le endpoint `PATCH /api/v1/invoices/{id}` retourne `400` avec un message explicite si
le payload est invalide ou n'applique aucune modification effective, et `409` si
le statut courant interdit la correction. Une facture hors de l'organisation courante
retourne `404`.

Dans les reponses OCR, `ocrAnalysis.fields[].corrected` vaut `true` lorsqu'une
valeur normalisee provient d'une correction manuelle.

## Endpoints Fournisseurs MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/suppliers?page=0&size=20` | Retourne une page de fournisseurs de l'organisation courante |
| `GET` | `/api/v1/suppliers/{id}` | Retourne le detail d'un fournisseur de l'organisation courante |
| `PATCH` | `/api/v1/suppliers/{id}` | Modifie les informations legales et de contact d'un fournisseur de l'organisation courante |

Un fournisseur absent ou rattache a une autre organisation retourne `404`. La modification
retourne `400` pour un identifiant legal invalide et `409` lorsqu'un SIRET ou un numero de TVA
est deja utilise par un autre fournisseur de l'organisation courante.

## Endpoints Regles Comptables MVP

| Methode | Endpoint | Role |
| --- | --- | --- |
| `GET` | `/api/v1/accounting-rules` | Liste les regles de l'organisation et indique si chaque configuration est complete |
| `PATCH` | `/api/v1/accounting-rules/{id}` | Modifie les comptes de charge, TVA et fournisseur d'une regle |

Une modification accepte uniquement des comptes actifs de l'organisation courante. Une regle
existante qui reference un compte inactif reste consultable avec `configurationComplete=false`.

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
