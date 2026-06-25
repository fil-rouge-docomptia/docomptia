# Exploitation Et Commandes Utiles

Ce document regroupe les commandes utiles pour travailler avec le stack Docker.

## Demarrer

Developpement:

```bash
make dev
```

Staging:

```bash
make staging
```

Production:

```bash
cp env/.env.prod.example env/.env.prod
make prod
```

## Arreter

```bash
make dev-down
make staging-down
make prod-down
```

## Voir Les Logs

Tous les services dev:

```bash
make logs
```

Un service precis:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  logs -f backend
```

## Voir L'etat Des Services

```bash
make ps
```

Ou:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  ps
```

## Rebuild Cible

Backend uniquement:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  build backend
```

OCR uniquement:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  build ocr
```

Frontend uniquement:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  build frontend
```

## Smoke Test Interne

Demarrer le stack commun sans ports publics:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  up -d --build postgres minio minio-init ocr backend
```

Tester le backend depuis le reseau Docker:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  exec -T ocr \
  python -c "import urllib.request; print(urllib.request.urlopen('http://backend:8080/api/hello').read().decode())"
```

Reponse attendue:

```text
Hello World
```

Nettoyer:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  down
```

## Probleme Frequent: Ports Deja Utilises

Modifier les ports dans `env/.env.dev`:

```text
FRONTEND_PORT=5174
BACKEND_PORT=8081
POSTGRES_PORT=5433
MINIO_API_PORT=9002
MINIO_CONSOLE_PORT=9003
OCR_PORT=8001
```

## Probleme Frequent: Donnees Corrompues En Dev

Reinitialiser les volumes dev:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  down -v
```

Puis relancer:

```bash
make dev
```
