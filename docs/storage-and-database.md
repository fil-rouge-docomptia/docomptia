# Stockage Et Base De Donnees

Le projet utilise PostgreSQL pour les donnees relationnelles et MinIO pour les fichiers de factures.

## PostgreSQL

Service Compose:

```text
postgres
```

Image:

```text
postgres:17-alpine
```

Variables principales:

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_PORT
```

Le backend se connecte via:

```text
jdbc:postgresql://postgres:5432/${POSTGRES_DB}
```

## Seed De Donnees

Le fichier PostgreSQL dedie est:

```text
backend/src/main/resources/data-postgres.sql
```

Il initialise les donnees minimales du MVP:

- organisation par defaut;
- roles;
- statuts facture;
- utilisateur admin de demo;
- fournisseur Orange;
- comptes comptables de base.

Les inserts utilisent `ON CONFLICT DO NOTHING` pour supporter les redemarrages, puis recalibrent les sequences PostgreSQL.

## MinIO

Service Compose:

```text
minio
```

Image:

```text
minio/minio:latest
```

Le bucket est cree automatiquement par:

```text
minio-init
docker/minio/init-buckets.sh
```

Bucket par defaut:

```text
invoice-files
```

## Flux De Stockage

```mermaid
sequenceDiagram
    participant B as Backend
    participant M as MinIO
    participant DB as PostgreSQL

    B->>M: putObject bucket invoice-files
    M-->>B: Objet cree
    B->>DB: Sauvegarde metadata fichier
```

Format du chemin sauvegarde:

```text
s3://invoice-files/invoices/{invoiceId}/{uuid}-{filename}
```

## Donnees Persistantes

Volumes Docker:

```text
postgres_data
minio_data
```

Supprimer les donnees d'un environnement:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  down -v
```

Attention: cette commande supprime les donnees PostgreSQL et les fichiers MinIO.

## Evolution Recommandee

Pour aller vers une production plus robuste:

- remplacer `ddl-auto=update` par des migrations Flyway ou Liquibase;
- externaliser les backups PostgreSQL;
- externaliser MinIO ou utiliser un S3 gere;
- ajouter une politique de retention des fichiers;
- ajouter un endpoint backend pour telecharger les fichiers stockes.
