# Exploitation Et Commandes Utiles

Ce document regroupe les commandes utiles pour travailler avec le stack Docker.

## Demarrer

Developpement:

```bash
make dev
```

Staging:

```bash
cp env/.env.staging.example env/.env.staging
make staging
```

Production:

```bash
cp env/.env.prod.example env/.env.prod
make prod
```

## Deploiement Production

Le deploiement production est gere par le workflow GitHub Actions
`Deploy production`.

Mode de declenchement recommande:

- declencher le workflow manuellement avec `workflow_dispatch`;
- utiliser l'environnement GitHub `production`;
- proteger cet environnement avec une validation explicite avant execution.

Le workflow production deploie la branche `main` sur le VPS de production avec:

```bash
docker compose --env-file env/.env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up --build -d
```

Les secrets de production doivent etre configures dans l'environnement GitHub
`production`, pas dans Git:

```text
PROD_SSH_HOST
PROD_SSH_PORT
PROD_SSH_USER
PROD_SSH_PRIVATE_KEY
PROD_SSH_KNOWN_HOSTS
PROD_DEPLOY_PATH
PROD_HEALTHCHECK_URL
```

Le fichier `env/.env.prod` doit rester uniquement sur le VPS de production. Il
est cree depuis `env/.env.prod.example`, puis complete avec les vraies valeurs
sensibles de production.

## Update Staging From Main

Le workflow GitHub Actions `Update staging from main` remet la branche
`staging` au meme niveau que `main`.

Il sert quand `main` a avance et que l'on veut repartir d'un staging propre
avant de tester de nouvelles features.

Mode de declenchement:

```text
GitHub -> Actions -> Update staging from main -> Run workflow
```

Le workflow fait un fast-forward strict de `staging` vers `main`, puis pousse
`staging`. Ce push relance automatiquement le workflow `Deploy staging`.

Si `staging` contient des commits absents de `main`, le fast-forward echoue.
Dans ce cas, il faut d'abord envoyer `staging` vers `main` ou resoudre l'ecart
manuellement.

## Create PR From Staging To Main

Le workflow GitHub Actions `Create PR from staging to main` prepare une PR de
`staging` vers `main` apres validation du VPS staging.

Il sert quand les tests staging sont OK et que l'on veut proposer ces
changements pour la branche principale.

Mode de declenchement:

```text
GitHub -> Actions -> Create PR from staging to main -> Run workflow
```

Le workflow affiche un lien GitHub pour ouvrir une PR avec:

```text
base: main
compare: staging
```

Il ne cree pas et ne merge pas automatiquement la PR. L'ouverture de la PR, sa
verification, la CI et le merge final restent manuels.

Si `staging` ne contient aucun commit a envoyer vers `main`, le workflow
s'arrete sans creer de PR.

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
