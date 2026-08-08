FROM node:22-bookworm-slim AS web-build

WORKDIR /build

COPY package.json package-lock.json ./
RUN --mount=type=secret,id=corporate_ca \
    set -eu; \
    if grep -q "BEGIN CERTIFICATE" /run/secrets/corporate_ca; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca; \
    fi; \
    npm ci

COPY components.json ./
COPY web ./web
RUN npm run web:build

FROM maven:3.9.11-eclipse-temurin-25 AS java-tools

FROM node:22-bookworm-slim

ARG CODEX_CLI_VERSION=0.147.0

COPY --from=java-tools /opt/java/openjdk /opt/java/openjdk
COPY --from=java-tools /usr/share/maven /usr/share/maven

ENV JAVA_HOME=/opt/java/openjdk \
    MAVEN_USER_HOME=/home/agent/.kan-agent/cache/maven \
    MAVEN_OPTS=-Dmaven.repo.local=/home/agent/.kan-agent/cache/maven/repository \
    KAN_AGENT_MAVEN_CACHE_SOURCE=/home/agent/.kan-agent/cache/maven \
    PATH=/opt/java/openjdk/bin:/usr/share/maven/bin:${PATH}

RUN --mount=type=secret,id=corporate_ca \
    set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends bubblewrap ca-certificates git openssh-client; \
    if grep -q "BEGIN CERTIFICATE" /run/secrets/corporate_ca; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca; \
      keytool -importcert -noprompt -trustcacerts -alias corporate-ca \
        -file /run/secrets/corporate_ca \
        -keystore "${JAVA_HOME}/lib/security/cacerts" \
        -storepass changeit; \
    fi; \
    npm install --global "@openai/codex@${CODEX_CLI_VERSION}"; \
    rm -rf /var/lib/apt/lists/*; \
    mkdir -p /home/agent; \
    chmod 0777 /home/agent

WORKDIR /opt/kan-agent

COPY package.json package-lock.json README.md config.example.json .env.example ./
COPY bin ./bin
COPY prompts ./prompts
COPY schemas ./schemas
COPY src ./src
COPY --from=web-build /build/web/dist ./web/dist

ENV HOME=/home/agent \
    KAN_AGENT_CONFIG=/opt/kan-agent/config.docker.json \
    KAN_AGENT_WEB_HOST=0.0.0.0 \
    KAN_AGENT_WEB_PORT=4310 \
    OPENAI_CODEX_BIN=/usr/local/bin/codex

COPY config.docker.json ./config.docker.json
COPY docker-entrypoint.sh /usr/local/bin/kan-agent-entrypoint
COPY bin/git-credential-github /usr/local/bin/git-credential-github

RUN chmod 0755 /usr/local/bin/kan-agent-entrypoint /usr/local/bin/git-credential-github

EXPOSE 4310

ENTRYPOINT ["kan-agent-entrypoint"]
