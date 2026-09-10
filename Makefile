COMPOSE = docker compose
BASE = -f docker-compose.yml
DEV = --env-file env/.env.dev $(BASE) -f docker-compose.dev.yml
STAGING = --env-file env/.env.staging $(BASE) -f docker-compose.staging.yml
PROD = --env-file env/.env.prod $(BASE) -f docker-compose.prod.yml
AGENT = --env-file tools/kan-agent/.env.local -f docker-compose.agent.yml
AGENT_USER = KAN_AGENT_UID=$(shell id -u) KAN_AGENT_GID=$(shell id -g)

.PHONY: dev dev-down staging staging-down prod prod-down logs ps agent-init agent agent-down agent-logs

dev:
	$(COMPOSE) $(DEV) up -d --build

dev-down:
	$(COMPOSE) $(DEV) down

staging:
	$(COMPOSE) $(STAGING) up --build -d --remove-orphans

staging-down:
	$(COMPOSE) $(STAGING) down

prod:
	$(COMPOSE) $(PROD) up --build -d --remove-orphans

prod-down:
	$(COMPOSE) $(PROD) down

logs:
	$(COMPOSE) $(DEV) logs -f

ps:
	$(COMPOSE) $(DEV) ps

agent-init:
	@if [ ! -f tools/kan-agent/.env.local ]; then \
		cp tools/kan-agent/.env.example tools/kan-agent/.env.local; \
		chmod 600 tools/kan-agent/.env.local; \
		echo "Created tools/kan-agent/.env.local"; \
	else \
		echo "tools/kan-agent/.env.local already exists"; \
	fi
	@mkdir -p $(HOME)/.kan-agent

agent:
	$(AGENT_USER) $(COMPOSE) $(AGENT) up --build

agent-down:
	$(AGENT_USER) $(COMPOSE) $(AGENT) down

agent-logs:
	$(AGENT_USER) $(COMPOSE) $(AGENT) logs -f
