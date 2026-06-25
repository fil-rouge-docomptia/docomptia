COMPOSE = docker compose
BASE = -f docker-compose.yml
DEV = --env-file env/.env.dev $(BASE) -f docker-compose.dev.yml
STAGING = --env-file env/.env.staging $(BASE) -f docker-compose.staging.yml
PROD = --env-file env/.env.prod $(BASE) -f docker-compose.prod.yml

.PHONY: dev dev-down staging staging-down prod prod-down logs ps

dev:
	$(COMPOSE) $(DEV) up --build

dev-down:
	$(COMPOSE) $(DEV) down

staging:
	$(COMPOSE) $(STAGING) up --build -d

staging-down:
	$(COMPOSE) $(STAGING) down

prod:
	$(COMPOSE) $(PROD) up --build -d

prod-down:
	$(COMPOSE) $(PROD) down

logs:
	$(COMPOSE) $(DEV) logs -f

ps:
	$(COMPOSE) $(DEV) ps
