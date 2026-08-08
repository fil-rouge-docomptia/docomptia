# KAN Agent

Agent local qui orchestre Jira, Git et Codex pour implementer un ticket dans un
worktree dedie. Une interface React permet de choisir l'epic et le ticket, suivre
les etapes en direct, consulter la review, demander une correction, approuver et
pousser la branche. Le CLI historique reste disponible.

## Demarrage Avec Docker

Le conteneur est la methode recommandee pour partager l'agent avec les autres
developpeurs. Depuis la racine de `SourceCode`:

```bash
make agent-init
```

Completer ensuite `tools/kan-agent/.env.local`:

```dotenv
JIRA_BASE_URL=https://organisation.atlassian.net
JIRA_EMAIL=utilisateur@entreprise.fr
JIRA_API_TOKEN=token-api-jira
GITHUB_TOKEN=token-github-optionnel
GIT_USER_NAME=Prenom Nom
GIT_USER_EMAIL=utilisateur@entreprise.fr
```

Puis lancer l'agent:

```bash
make agent
```

L'interface est disponible sur `http://127.0.0.1:4310`.

Le conteneur monte uniquement les ressources necessaires:

- le depot courant dans `/workspace`, pour creer les branches et commits;
- `~/.codex`, pour reutiliser l'authentification Codex CLI;
- `~/.kan-agent`, pour conserver l'etat, les logs et l'historique;
- `~/.ssh` en lecture seule, pour les remotes Git utilisant SSH.

Les chemins `~/.kan-agent` sont identiques dans le conteneur et sur l'hote. Les
worktrees conserves apres une erreur restent donc visibles et administrables
avec les commandes Git habituelles depuis `SourceCode`.

Si le remote Git utilise HTTPS, renseigner un `GITHUB_TOKEN` finement limite avec
un acces en lecture et ecriture au depot. Ce token et les identifiants Jira sont
retires de l'environnement transmis au processus Codex.

Commandes Docker utiles:

```bash
make agent
make agent-logs
make agent-down
```

Le port est lie a `127.0.0.1` uniquement. Pour utiliser un autre port local:

```bash
KAN_AGENT_PORT=4312 make agent
```

Le Makefile transmet automatiquement l'UID et le GID du developpeur au
conteneur afin d'eviter la creation de fichiers appartenant a `root` dans le
depot. Codex doit avoir ete authentifie une premiere fois sur la machine hote.

### Proxy D'entreprise

Si l'entreprise intercepte les connexions HTTPS, fournir son autorite de
certification dans `tools/kan-agent/.env.local`:

```dotenv
KAN_AGENT_CA_CERTIFICATE=/chemin/absolu/ca-entreprise.pem
```

Le certificat est utilise comme secret pendant la construction puis monte en
lecture seule au runtime. Il n'est jamais copie dans l'image ou ajoute au depot.
Lancer ensuite normalement `make agent`. Ne pas utiliser `strict-ssl=false`.

## Interface Graphique

Installer une fois les dependances de l'interface depuis le dossier de l'agent:

```bash
cd tools/kan-agent
npm install
```

Puis lancer l'API locale et React avec une seule commande:

```bash
npm run web
```

Ouvrir ensuite `http://127.0.0.1:4311`. L'API ecoute uniquement sur
`127.0.0.1:4310`; les identifiants Jira restent dans le processus Node et ne sont
jamais envoyes au navigateur.

L'interface propose:

- un diagnostic Node, Git, Codex et Jira;
- le chargement des epics et tickets Jira;
- une confirmation avant le lancement du ticket;
- le suivi des statuts et des logs en direct;
- la review des commits, fichiers et tests;
- une demande de revision en langage naturel;
- une approbation explicite avant le push;
- l'historique des workflows archives.

Pour servir une version compilee sur le seul port `4310`:

```bash
npm run web:build
npm run web:server
```

## Prerequis

- Node.js 20 ou plus recent;
- Git;
- Codex CLI installe et authentifie;
- un compte Jira Cloud et un API token.

Le lanceur `bin/kan-agent` detecte automatiquement une version Node compatible
installee avec NVM. Seule l'interface graphique necessite une installation npm.

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

La commande cree deux fichiers ignores par Git:

- `tools/kan-agent/config.local.json` pour la configuration de l'outil;
- `tools/kan-agent/.env.local` pour les identifiants Jira.

Configurer les variables dans `.env.local`:

```dotenv
JIRA_BASE_URL=https://organisation.atlassian.net
JIRA_EMAIL=utilisateur@entreprise.fr
JIRA_API_TOKEN=token-api-jira
```

Le fichier est cree avec des permissions limitees a l'utilisateur courant. Les
variables deja exportees dans le terminal restent prioritaires sur ce fichier.

Verifier ensuite toute la configuration:

```bash
./tools/kan-agent/bin/kan-agent doctor
```

Le token Jira n'est jamais transmis au processus Codex.

Pour chaque ticket, Codex lit automatiquement les regles du projet, les besoins
consolides, les decisions validees, les huit workflows transcrits et le registre
des sources. Si un document n'existe pas encore dans la branche du ticket,
l'agent utilise sa version presente dans le depot `SourceCode`.

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

- le worktree ne contient aucun changement non commite bloquant;
- au moins un commit existe;
- chaque commit commence par la cle du ticket;
- aucun fichier interdit n'est present;
- aucun test n'est signale en echec.

Lorsqu'une commande de test est relancee apres une correction, son dernier
resultat remplace le precedent pour l'affichage et la validation.

Les chemins declares dans `git.ignoredWorkingTreeFiles` restent affiches dans
la review, mais ne bloquent pas `approve` ou `push`. Cette liste sert uniquement
aux adaptations locales de developpement, par exemple les certificats Netskope,
les `Dockerfile.dev`, `out/` et les caches Python. Elle ne masque pas ces fichiers
s'ils sont commites: `git.forbiddenFiles` continue alors de refuser le ticket.

`push` redemande une confirmation, pousse la branche, ajoute un commentaire Jira
et place le ticket dans le statut configure pour la code review. Le CLI ne passe
jamais automatiquement un ticket a `Done`.

## Travail Git

Le CLI utilise directement le depot Git du projet `SourceCode`. Les branches et
les commits crees par l'agent sont donc visibles depuis le depot principal avec:

```bash
git branch
git log --oneline --all
```

Pour ne pas modifier la branche ou les fichiers actuellement ouverts par le
developpeur, chaque ticket est execute dans un worktree lie au meme depot:

```text
~/.kan-agent/workspaces/facturation/source-worktrees/KAN-XX_titre_du_ticket
```

Il n'existe plus de second clone Git. A chaque nouveau ticket, l'agent execute
`fetch origin` et cree la branche depuis `origin/main`, sans changer la branche
courante de `SourceCode`.

Lorsque l'execution Codex se termine et que tous les changements sont commites,
l'agent supprime automatiquement le worktree temporaire. La branche et ses
commits restent disponibles dans `SourceCode` et peuvent etre ouverts avec
`git switch KAN-XX_nom_du_ticket`. Les commandes `review`, `approve` et `push`
continuent de fonctionner sans le worktree. La commande `revise` le recree
temporairement, puis le libere apres la revision.

Un worktree contenant des changements non commites n'est jamais supprime. Dans
ce cas, `kan-agent status` signale qu'il est conserve afin d'eviter toute perte.

## Verification Du CLI

```bash
cd tools/kan-agent
./bin/kan-agent --help
npm run check
npm test
```

Les tests locaux ne contactent ni Jira, ni GitHub, ni Codex.
