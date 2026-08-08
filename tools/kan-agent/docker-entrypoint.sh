#!/bin/sh

set -eu

if grep -q "BEGIN CERTIFICATE" /run/secrets/corporate_ca; then
  cat /etc/ssl/certs/ca-certificates.crt /run/secrets/corporate_ca > /tmp/kan-agent-ca-bundle.pem
  export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca
  export SSL_CERT_FILE=/tmp/kan-agent-ca-bundle.pem
  export GIT_SSL_CAINFO=/tmp/kan-agent-ca-bundle.pem
fi

export GIT_CONFIG_GLOBAL=/tmp/kan-agent-gitconfig
git config --global --add safe.directory /workspace
git config --global user.name "${GIT_USER_NAME:-KAN Agent}"
git config --global user.email "${GIT_USER_EMAIL:-${JIRA_EMAIL:-kan-agent@localhost}}"

if [ -n "${GITHUB_TOKEN:-${GH_TOKEN:-}}" ]; then
  git config --global credential.helper /usr/local/bin/git-credential-github
fi

mkdir -p "${MAVEN_USER_HOME}"
if [ -f /workspace/backend/mvnw ]; then
  echo "Preparing the persistent Maven cache..."
  if ! (
    cd /workspace/backend
    ./mvnw -q -DskipTests dependency:go-offline
    ./mvnw -q -Dtest=BackendApplicationTests test
  ); then
    echo "Warning: Maven dependencies could not be preloaded; the agent will still start." >&2
  fi
fi

exec node /opt/kan-agent/src/web-server.mjs
