# Environnements Docker

Le projet utilise un fichier Compose commun et trois overrides:

```text
docker-compose.yml
docker-compose.dev.yml
docker-compose.staging.yml
docker-compose.prod.yml
```

## Fichier Commun

`docker-compose.yml` declare les services partages:

- `postgres`
- `minio`
- `minio-init`
- `ollama`
- `ollama-init`
- `ocr`
- `backend`
- `frontend`

Il definit aussi:

- le reseau Docker `facturation`
- les volumes `postgres_data`, `minio_data` et `ollama_data`
- les healthchecks de PostgreSQL, MinIO et OCR
- les variables communes de connexion entre services

## Developpement

Commande:

```bash
make dev
```

Equivalent:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up --build
```

Caracteristiques:

| Service | Comportement dev |
| --- | --- |
| frontend | Vite avec hot reload |
| backend | Maven `spring-boot:run` |
| ocr | Uvicorn `--reload` |
| ollama | Modele LLM local expose en dev |
| postgres | Port expose localement |
| minio | API et console exposees |

Ports par defaut:

```text
Frontend:      http://localhost:5173
Backend:       http://localhost:8080
OCR:           http://localhost:8000
Ollama:        http://localhost:11434
MinIO API:     http://localhost:9000
MinIO Console: http://localhost:9001
PostgreSQL:    localhost:5432
```

Le service `ollama-init` tente de telecharger `OLLAMA_MODEL` dans le volume `ollama_data` au premier demarrage. Si le telechargement echoue, le stack continue de demarrer et l'OCR utilise son fallback regex jusqu'a ce que le modele soit disponible.

## Staging

Commande:

```bash
make staging
```

Equivalent:

```bash
docker compose --env-file env/.env.staging \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  up --build -d
```

Caracteristiques:

- Images optimisees.
- Reverse proxy Nginx.
- `restart: unless-stopped`.
- Entree HTTP via `HTTP_PORT`, par defaut `8080`.

## Production

Preparer les variables:

```bash
cp env/.env.prod.example env/.env.prod
```

Modifier toutes les valeurs sensibles:

```text
POSTGRES_PASSWORD
MINIO_ROOT_PASSWORD
HTTP_PORT
```

Demarrer:

```bash
make prod
```

Equivalent:

```bash
docker compose --env-file env/.env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up --build -d
```

Caracteristiques:

- Images optimisees.
- Reverse proxy Nginx.
- `restart: always`.
- Seul le reverse proxy est expose.

## Arret

```bash
make dev-down
make staging-down
make prod-down
```

Pour supprimer aussi les volumes:

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  down -v
```

Attention: `down -v` supprime les donnees PostgreSQL et MinIO de l'environnement cible.

## Validation Compose

```bash
docker compose --env-file env/.env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  config --quiet
```

```bash
docker compose --env-file env/.env.staging \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  config --quiet
```

```bash
docker compose --env-file env/.env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  config --quiet
```
