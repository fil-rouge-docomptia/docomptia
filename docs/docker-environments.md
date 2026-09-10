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
- `ocr`
- `backend`
- `frontend`

Il definit aussi:

- le nom du projet via `COMPOSE_PROJECT_NAME`, obligatoire dans le fichier d'environnement
- le reseau Docker `facturation`
- les volumes `postgres_data` et `minio_data`
- les healthchecks de PostgreSQL, MinIO et OCR
- les variables communes de connexion entre services

Les noms de projet sont `docomptia-dev`, `docomptia-staging` et `docomptia-prod`.
Ils sont definis respectivement dans `env/.env.dev`, `env/.env.staging.example`
et `env/.env.prod.example`. Sur le VPS, reporter les nouveaux noms dans les
fichiers `.env.staging` et `.env.prod` existants apres avoir prepare
[la migration des volumes](vps-traefik.md#renommer-un-projet-compose-existant).

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
| postgres | Port expose localement |
| minio | API et console exposees |

Ports par defaut:

```text
Frontend:      http://localhost:5173
Backend:       http://localhost:8080
OCR:           http://localhost:8000
MinIO API:     http://localhost:9000
MinIO Console: http://localhost:9001
PostgreSQL:    localhost:5432
```

## Staging

Preparer les variables:

```bash
cp env/.env.staging.example env/.env.staging
```

Remplacer les secrets et verifier le domaine avant le demarrage.
Le reseau externe `proxy` et le Traefik global doivent etre prepares selon
[la procedure VPS](vps-traefik.md).

Commande:

```bash
make staging
```

Equivalent:

```bash
docker compose --env-file env/.env.staging \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  up --build -d --remove-orphans
```

Caracteristiques:

- Images optimisees.
- Routage HTTPS via le Traefik global du VPS.
- Frontend Nginx conserve pour servir les fichiers React.
- `restart: unless-stopped`.
- Entree publique: `https://staging.docomptia.com`, API sous `/api`.
- Aucun port hote publie par le projet.

## Production

Preparer les variables:

```bash
cp env/.env.prod.example env/.env.prod
```

Modifier toutes les valeurs sensibles:

```text
POSTGRES_PASSWORD
MINIO_ROOT_PASSWORD
APP_JWT_SECRET
APP_CORS_ALLOWED_ORIGINS
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
  up --build -d --remove-orphans
```

Caracteristiques:

- Images optimisees.
- Routage HTTPS via le Traefik global du VPS.
- Frontend Nginx conserve pour servir les fichiers React.
- `restart: always`.
- Entree publique: `https://docomptia.com`, API sous `/api`.
- Aucun port hote publie par le projet ; Traefik publie 80/443.

Seuls `frontend` et `backend` rejoignent le reseau externe `proxy`, avec des
alias propres a chaque environnement. Les autres services restent sur leur
reseau `facturation`. `--remove-orphans` retire les anciens conteneurs absents
du Compose, dont `reverse-proxy`, uniquement dans le projet Compose concerne.
Preparer la reprise des volumes si le nom du projet change ; voir
[les etapes de bascule et de verification](vps-traefik.md).

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
