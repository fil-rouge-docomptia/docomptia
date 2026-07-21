# Architecture Complete

Ce document decrit l'architecture applicative et l'infrastructure Docker actuellement mise en place pour le MVP.

## Vue D'ensemble

```mermaid
flowchart TB
    browser[Utilisateur / Navigateur]

    subgraph edge[Entree HTTP]
        proxy[Nginx reverse-proxy staging/prod]
    end

    subgraph app[Application]
        frontend[Frontend React + Vite]
        backend[Backend Spring Boot Java 25]
        ocr[OCR FastAPI]
        tesseract[Tesseract OCR]
    end

    subgraph data[Donnees]
        postgres[(PostgreSQL)]
        minio[(MinIO S3)]
        bucket[(Bucket invoice-files)]
    end

    browser --> proxy
    proxy -->|/| frontend
    proxy -->|/api/*| backend

    browser -. dev direct .-> frontend
    frontend -->|HTTP API| backend

    backend -->|JDBC| postgres
    backend -->|S3 API| minio
    minio --> bucket
    backend -->|HTTP multipart| ocr
    ocr --> tesseract
```

En developpement, les ports des services sont exposes directement. En staging et prod, l'entree recommandee est le reverse proxy Nginx.

## Services

| Service Compose | Role | Image / Build |
| --- | --- | --- |
| `frontend` | Interface React | `frontend/Dockerfile` ou `frontend/Dockerfile.dev` |
| `backend` | API metier Spring Boot | `backend/Dockerfile` ou `backend/Dockerfile.dev` |
| `postgres` | Base relationnelle | `postgres:17-alpine` |
| `minio` | Stockage objet S3-compatible | `minio/minio:latest` |
| `minio-init` | Creation du bucket | `minio/mc:latest` |
| `ocr` | Extraction OCR | `ocr/Dockerfile` ou `ocr/Dockerfile.dev` |
| `reverse-proxy` | Routage HTTP staging/prod | `nginx:1.27-alpine` |

## Reseau Docker

```mermaid
flowchart LR
    subgraph network[facturation network]
        frontend
        backend
        postgres
        minio
        minioInit[minio-init]
        ocr
        reverseProxy[reverse-proxy]
    end

    reverseProxy --> frontend
    reverseProxy --> backend
    backend --> postgres
    backend --> minio
    backend --> ocr
    minioInit --> minio
```

Les services utilisent les noms DNS internes Docker:

```text
postgres:5432
minio:9000
ocr:8000
backend:8080
frontend:80
```

## Flux Upload De Facture

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend
    participant S as MinIO
    participant O as OCR FastAPI
    participant DB as PostgreSQL

    U->>F: Selectionne une facture
    F->>B: POST /api/v1/invoices/upload
    B->>O: Envoie le fichier en multipart
    O->>O: Tesseract extrait le texte
    O-->>B: JSON OCR compatible DTO backend
    B->>DB: Cree la facture et les donnees OCR
    B->>S: Stocke le fichier original
    B->>DB: Sauvegarde le chemin s3://bucket/object
    B-->>F: Retourne facture et OCR
    F-->>U: Affiche les donnees extraites
    U->>F: Valide la generation comptable
    F->>B: POST /api/v1/invoices/{id}/accounting-entry
    B->>DB: Lit la regle comptable active
    B->>DB: Cree l'ecriture et ses lignes
    B-->>F: Retourne l'ecriture comptable
    F-->>U: Affiche l'ecriture comptable
```

## Flux De Demarrage Docker

```mermaid
sequenceDiagram
    participant P as postgres
    participant M as minio
    participant MI as minio-init
    participant O as ocr
    participant B as backend

    P->>P: healthcheck pg_isready
    M->>M: healthcheck /minio/health/live
    O->>O: healthcheck /health
    M-->>MI: MinIO healthy
    MI->>M: Cree le bucket invoice-files
    P-->>B: PostgreSQL healthy
    MI-->>B: Bucket initialise
    O-->>B: OCR healthy
    B->>B: Demarre Spring Boot
```

## Routage HTTP

En staging/prod, `docker/nginx/reverse-proxy.conf` route:

| Route | Destination |
| --- | --- |
| `/` | `frontend:80` |
| `/api/*` | `backend:8080` |

Le frontend de production est servi par Nginx depuis les fichiers statiques generes par Vite.

## Profils Spring

| Profil | Usage | Database | OCR | Stockage |
| --- | --- | --- | --- | --- |
| default | Tests/local hors Docker | H2 | Mock | Local temp |
| dev | Docker dev | PostgreSQL | FastAPI | MinIO |
| staging | Preproduction | PostgreSQL | FastAPI | MinIO |
| prod | Production | PostgreSQL | FastAPI | MinIO |

## Points A Surveiller

- `ddl-auto=update` est acceptable pour le MVP, mais pas pour une production durable.
- Les secrets prod doivent etre fournis via `.env.prod` non versionne.
- Le service OCR actuel fournit une extraction heuristique simple. Il faudra l'enrichir avec une vraie logique de parsing facture.
- Le stockage MinIO est local au compose. Pour une production externe, remplacer l'endpoint S3 et les credentials.
