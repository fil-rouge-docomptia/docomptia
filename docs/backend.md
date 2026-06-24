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
