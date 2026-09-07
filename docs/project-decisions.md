# Decisions Projet Validees

Ce document conserve les decisions stables issues des echanges de conception et
des implementations deja realisees. Il evite qu'un agent reutilise une ancienne
hypothese ou reinvente une solution qui a deja ete refusee.

Les decisions sont classees ainsi:

- **Validee**: doit guider les tickets suivants;
- **Temporaire**: acceptable pour le MVP, a ne pas presenter comme cible finale;
- **A confirmer**: necessite un ticket ou une validation metier;
- **Abandonnee**: ne doit pas etre reintroduite sans decision explicite.

## Produit Et Perimetre

### Validee - priorite aux factures fournisseurs

Le premier flux livre est la facture fournisseur: upload, fichier original,
OCR, correction, validation, comptabilisation et preparation de l'export. Les
factures clients, le SaaS complet et les connecteurs arrivent ensuite.

### Validee - le produit ne remplace pas une Plateforme Agreee

Docomptia traite les factures en interne et prepare leur integration. Une
connexion future a une Plateforme Agreee est prevue; aucun ticket ne doit
presenter le POC comme une plateforme certifiee.

### Validee - progression par tickets fonctionnels

Les besoins metier sont traites avant les abstractions techniques generales.
Une table, un service ou une dependance n'est ajoute que pour satisfaire un
ticket actuel. Les grands refactorings preventifs sont exclus du MVP.

## Architecture

### Validee - Spring Boot possede le metier

Le backend Spring Boot porte les regles metier, les transactions, la
persistance, les statuts, le stockage et l'orchestration. Les controleurs restent
fins et les responsabilites sont reparties entre services focalises.

### Validee - FastAPI porte le traitement OCR

Le service OCR reste separe en Python/FastAPI. Cette frontiere permet de faire
evoluer Tesseract, le pretraitement et le raffinement LLM sans deplacer les
regles metier hors de Spring Boot.

### Abandonnee - Tesseract integre directement dans Spring Boot

Cette piste a ete examinee pour simplifier le MVP, puis remplacee par
l'architecture Spring Boot + FastAPI OCR + Docker Compose. Elle ne doit pas etre
reintroduite par un ticket OCR sans nouvelle decision explicite.

### Validee - PostgreSQL et MinIO ont des responsabilites distinctes

PostgreSQL conserve les donnees metier et les metadonnees. MinIO conserve les
binaires via une API S3. Le stockage local peut exister derriere la meme
interface pour certains profils, mais le service appelant ne choisit pas le
stockage avec un `if`: Spring selectionne l'implementation par configuration.

## Upload Et Fichier

### Validee - upload independant du fournisseur

Le frontend n'a pas a connaitre un `supplierId` avant l'analyse. La facture
brouillon et le fichier existent avant l'OCR; le fournisseur est resolu apres
extraction ou correction.

### Validee - ordre de traitement

```text
valider le fichier
-> creer le brouillon
-> enregistrer l'historique de depot
-> stocker l'original
-> passer l'OCR en cours
-> analyser
-> appliquer les donnees
-> poursuivre le workflow
```

Les sauvegardes intermediaires sont justifiees par cet ordre metier: l'identite
du brouillon est necessaire au stockage et le document doit survivre a une panne
OCR.

### Validee - types cibles PDF et images usuelles

Le POC final du rapport accepte PDF et image. Une premiere etape avait limite le
test a PNG, JPG et JPEG; cette restriction etait temporaire. Word reste hors MVP
tant qu'un ticket ne le demande pas.

### Validee - validation defense en profondeur

La limite d'upload doit etre coherente dans Nginx, Spring Boot et le service OCR.
Le backend controle extension, MIME, taille et contenu minimal. Une requete
Postman doit utiliser `multipart/form-data` avec une part `file` de type File.

## OCR Et Extraction

### Validee - Tesseract est le moteur OCR de base

Tesseract extrait le texte; il ne garantit pas l'identification correcte des
champs. Le service OCR conserve donc une etape distincte d'extraction metier.

### Validee - le LLM est un raffinement facultatif

Un modele open source leger, execute localement via Ollama, peut structurer le
texte OCR. La piste retenue pour les essais est Qwen 2.5 7B. Le prompt exige un
JSON ferme et `null` pour toute valeur absente ou incertaine.

Le LLM ne doit pas:

- recevoir les secrets Jira ou Git;
- inventer une valeur;
- devenir indispensable a la conservation du document;
- contourner les validations de format, montant ou identite;
- bloquer le fallback deterministe si le modele est indisponible.

### Validee - aucune valeur metier artificielle

Les anciennes valeurs de secours comme nom de fournisseur generique, numero
fabrique ou montant zero sont interdites. Une extraction manquante reste
`null`, et la base doit autoriser temporairement cette incompletude tant que la
facture n'atteint pas une etape exigeant ces champs.

### Validee - confiance explicite, pas arbitraire

Le score actuel peut provenir du service OCR et de l'extracteur, mais il ne doit
pas etre presente comme une probabilite scientifique sans mesure. Les valeurs
fixes comme `0.70` sont temporaires. Un corpus de factures annotees doit mesurer
precision par champ, taux de champs manquants et taux de correction humaine.

### Validee - moteur et version persistables

Chaque extraction doit pouvoir indiquer le moteur reel et sa version. Une erreur
OCR doit conserver son detail technique utile, un statut explicite et la
possibilite de relancer l'analyse du fichier original.

## Fournisseurs Et Multi-Tenant

### Validee - identite limitee a l'organisation

Une organisation gere plusieurs fournisseurs. Un meme nom peut exister dans
plusieurs organisations. La recherche et les contraintes doivent toujours
inclure l'organisation active.

### Validee - priorite aux identifiants legaux

Le SIRET et le numero de TVA sont plus fiables que le nom. Le nom ou la raison
sociale ne doivent pas etre rendus globalement uniques pour masquer une
ambiguite. Une contrainte d'unicite pertinente porte sur l'organisation et un
identifiant fiable, avec gestion des valeurs nulles.

### Abandonnee - recherche ambigue par deux noms

Une methode du type
`findByNameIgnoreCaseOrLegalNameIgnoreCase(name, legalName)` peut retourner plus
d'un resultat et ne definit pas l'identite du fournisseur. Elle ne doit pas etre
la regle principale de rattachement.

## Statuts Et Workflow

### Validee - codes centralises

Les statuts ne sont pas ecrits en chaines dispersees. Les enums Java exposent un
`code` identique a la valeur stockee en base. Les donnees d'initialisation et
les enums doivent etre verifies par un test d'alignement.

### Validee - transitions metier controlees

Le backend recherche l'entite `InvoiceStatus` par code pour rattacher la facture
a la ligne de reference en base. Une transition ne consiste pas seulement a
changer une chaine: elle valide le statut source, l'action, le role et les
preconditions, puis enregistre l'historique.

### Validee - flux frontend en plusieurs etapes

Un endpoint d'upload ne doit pas realiser silencieusement tout le cycle jusqu'a
la validation et l'export. Le frontend avance par actions explicites: upload et
analyse, correction, generation ou consultation comptable, validation/refus,
export. Chaque reponse contient uniquement les donnees necessaires a l'etape.

## Comptabilite

### Validee - ecriture et lignes separees

Une ecriture comptable porte l'entete: facture, date, numero, libelle, statut et
auteur. Les lignes portent compte, libelle, numero de ligne, debit ou credit.

### Validee - nombre de lignes dynamique

Trois lignes constituent un exemple courant, pas une structure imposee. Les
lignes sont generees a partir des montants valides, des lignes de facture, du
plan comptable et des regles configurees par l'organisation.

### Validee - configuration administrateur

L'administrateur importe ou cree le plan comptable, active les comptes et
definit les correspondances fournisseur, TVA, charge ou produit. Le service de
facture ne doit pas contenir des numeros ou types comptables metier en dur pour
simuler cette configuration.

### Validee - controle d'equilibre bloquant

La somme des debits doit egaler la somme des credits. Une proposition
desequilibree reste corrigeable mais ne devient ni validee comptablement ni
exportable.

### Validee - idempotence

La generation recherche l'ecriture existante de la facture avant d'en creer une
nouvelle. Une nouvelle requete ne doit pas dupliquer l'ecriture ou ses lignes.

### Validee - correction apres export par extourne

Une ecriture exportee n'est pas modifiee. Une correction produit une ecriture
inverse et une nouvelle ecriture correcte, toutes deux journalisees.

## Abonnement SaaS

### Temporaire - catalogue initial des plans

Pour debloquer le MVP, le catalogue initial utilise les valeurs provisoires
suivantes. Elles doivent etre validees avant une mise en production commerciale.

| Code | Nom | Utilisateurs actifs maximum | Factures par mois | Fonctionnalites |
| --- | --- | ---: | ---: | --- |
| `STARTER` | Starter | 2 | 100 | `INVOICE_MANAGEMENT`, `OCR`, `ACCOUNTING_EXPORT` |
| `BUSINESS` | Business | 10 | 1 000 | Fonctionnalites Starter, `APPROVAL_WORKFLOW`, `AUDIT_LOG` |
| `PRO` | Pro | Illimite | Illimite | Fonctionnalites Business, `API_ACCESS`, `ADVANCED_CONNECTORS` |

Les limites sont appliquees par organisation. La limite de factures correspond
au nombre de documents de facture acceptes pendant un mois calendaire. Une
limite absente represente un usage illimite; aucune valeur numerique artificielle
ne doit representer l'illimite.

Les trois plans sont crees actifs avec un code stable et unique. Un plan est
desactive par un indicateur d'activite et n'est jamais supprime, afin de conserver
l'historique des abonnements. Pour KAN-231, les limites et fonctionnalites sont
consultables par `GET /api/v1/subscription-plans`; la reponse retourne uniquement
les plans actifs. L'affectation d'un plan a une organisation, le controle des
quotas, les prix, la facturation et les changements d'offre restent hors du
perimetre de ce ticket.

## API Et Frontend

### Validee - contrats minimaux et documentes

Les DTO de reponse sont adaptes a l'ecran et ne retournent pas les entites JPA
completes. Swagger doit decrire un upload comme un fichier binaire multipart,
pas comme une simple chaine.

### Validee - frontend organise sans abstraction prematuree

Les pages sont separees des composants reutilisables. Le design system conserve
la navigation et les composants stables; les hooks sont ajoutes seulement pour
une logique reutilisable. React, TypeScript, Vite, Tailwind et shadcn restent la
base actuelle.

### Validee - CORS configure par environnement

L'adresse du frontend autorisee est une configuration du backend. Elle n'est
pas codee en dur pour tous les environnements.

## Environnements Et Docker

### Validee - profils Spring par environnement

`application.yml` porte les valeurs communes. Les fichiers
`application-dev.yml`, `application-staging.yml` et `application-prod.yml`
portent les differences. `SPRING_PROFILES_ACTIVE` selectionne le profil; les
variables d'environnement Docker remplacent les proprietes Spring de meme nom.

### Validee - Docker Compose par superposition

Le fichier principal decrit les services communs. Les fichiers dev, staging ou
prod les surchargent. `--no-cache` appartient a `docker compose build`, pas a
`docker compose up`.

### Validee - certificats entreprise locaux exclus des commits

Les certificats Netskope et les contournements reseau servent uniquement a
l'environnement d'entreprise local. Ils ne font pas partie des commits metier
ou de l'image generique. `ca-certificates` fournit les autorites de confiance du
conteneur; une autorite Netskope ajoutee signifie explicitement que le
conteneur fait confiance au proxy TLS de l'entreprise.

### Temporaire - desactivation de `strict-ssl`

`npm config set strict-ssl false` contourne la verification TLS et ne constitue
pas une solution production. Preferer une chaine de certificats correctement
configuree.

## Donnees Et Migrations

### Validee - les contraintes doivent correspondre au workflow

Une colonne obligatoire uniquement apres validation peut rester nullable durant
le brouillon. Les contraintes d'unicite etrangeres au multi-tenant sont evitees.
Les migrations ou scripts SQL necessaires sont versionnes avec le ticket qui
change le schema.

### Validee - ne pas reinserer une reference existante

Les statuts, roles ou comptes de reference sont recherches ou initialises de
maniere idempotente. Une violation de cle unique indique qu'un script ou un
service tente de recreer une valeur deja presente.

## Agent Jira Et Git

### Validee - contexte reconstruit depuis des sources durables

L'agent ne depend pas de l'historique d'un chat. Il lit `AGENTS.md`, les
documents de contexte, Jira, le code, les tests et Git. Les documents sources
sont consolides en Markdown pour etre disponibles sur chaque machine.

### Validee - validation humaine avant push

L'agent peut analyser, modifier, tester et commiter. Il ne pousse jamais sans
`approve`, ne passe jamais automatiquement le ticket a `Done` et ne transmet
pas les secrets Jira au processus Codex.

### Validee - commits atomiques

Les commits fonctionnels utilisent `KAN-XX: Message`. Ils n'incluent pas les
certificats, Netskope, Docker sans rapport, `__pycache__`, `out` ou d'autres
changements locaux.

### Validee - inspecter avant de coder

Pour chaque ticket, l'agent lit les instructions, compare la demande au code et
a l'historique, explique le besoin metier, effectue des changements minimaux et
execute les tests pertinents. En cas de contradiction, il s'arrete et signale
le conflit.

## Points A Confirmer

- strategie exacte de numerotation des factures et pieces par organisation;
- format CSV MVP et mapping vers les logiciels comptables;
- conformite complete du FEC et jeux de validation associes;
- seuils et regles du workflow de validation;
- modele de permission par classeur ou dossier;
- politique d'archivage legal et prestataire eventuel;
- moteur LLM, taille de modele et infrastructure cible apres benchmark;
- regles comptables detaillees par nature de depense et taux de TVA;
- modele de donnees des factures clients et de leurs lignes;
- politique de paiement et de rapprochement bancaire.

Un agent ne doit pas trancher seul ces points dans un ticket qui ne les precise
pas.
