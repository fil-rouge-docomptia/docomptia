# KAN Agent

CLI local qui orchestre Jira, Git et Codex pour implementer un ticket dans un
worktree dedie. Codex modifie, teste et commite le code. Le CLI interdit le push
avant une approbation explicite de l'utilisateur.

## Prerequis

- Node.js 20 ou plus recent;
- Git;
- Codex CLI installe et authentifie;
- un compte Jira Cloud et un API token.

Le lanceur `bin/kan-agent` detecte automatiquement une version Node compatible
installee avec NVM. Le CLI n'a aucune dependance npm a installer.

Pour executer directement les scripts npm de verification, activer d'abord une
version recente:

```bash
nvm use 20
```

Sur macOS, le CLI detecte automatiquement le binaire OpenAI inclus dans
`/Applications/ChatGPT.app`. La commande npm historique nommee `codex` n'est pas
le Codex CLI d'OpenAI et sera ignoree. Un chemin personnalise peut etre fourni:

```bash
export OPENAI_CODEX_BIN="/chemin/vers/codex"
```

## Configuration

Depuis la racine du projet:

```bash
./tools/kan-agent/bin/kan-agent init
```

La commande cree `tools/kan-agent/config.local.json`. Modifier au minimum l'URL
Jira si elle n'est pas fournie par l'environnement.

Configurer les secrets uniquement dans le terminal:

```bash
export JIRA_BASE_URL="https://organisation.atlassian.net"
export JIRA_EMAIL="utilisateur@entreprise.fr"
export JIRA_API_TOKEN="token-api-jira"
```

Verifier ensuite toute la configuration:

```bash
./tools/kan-agent/bin/kan-agent doctor
```

Le token Jira n'est jamais transmis au processus Codex.

Si Jira n'utilise pas `parent` pour relier les tickets aux epics, adapter
`jira.childrenJqlTemplate` dans `config.local.json`, par exemple avec le champ
`Epic Link` de l'instance.

## Utilisation

```bash
./tools/kan-agent/bin/kan-agent start
./tools/kan-agent/bin/kan-agent status
./tools/kan-agent/bin/kan-agent review
./tools/kan-agent/bin/kan-agent revise "Separe cette logique dans un service"
./tools/kan-agent/bin/kan-agent approve
./tools/kan-agent/bin/kan-agent push
```

Le workflow est volontairement sequentiel:

```text
SELECTED
-> PREPARED
-> IN_PROGRESS
-> REVIEW_REQUIRED
-> APPROVED
-> PUSHED
-> JIRA_UPDATED
```

`approve` verifie que:

- le worktree est propre;
- au moins un commit existe;
- chaque commit commence par la cle du ticket;
- aucun fichier interdit n'est present;
- aucun test n'est signale en echec.

`push` redemande une confirmation, pousse la branche, ajoute un commentaire Jira
et place le ticket dans le statut configure pour la code review. Le CLI ne passe
jamais automatiquement un ticket a `Done`.

## Isolation Git

Le CLI utilise un clone de base dans:

```text
~/.kan-agent/workspaces/facturation/base
```

et un worktree par ticket dans:

```text
~/.kan-agent/workspaces/facturation/worktrees/KAN-XX_titre_du_ticket
```

Il ne travaille donc pas dans le workspace utilise par le developpeur. A chaque
nouveau ticket, il execute `fetch`, `switch main` et `pull --ff-only` avant de
creer la branche.

## Verification Du CLI

```bash
cd tools/kan-agent
./bin/kan-agent --help
npm run check
npm test
```

Les tests locaux ne contactent ni Jira, ni GitHub, ni Codex.
