# Besoins Produit Consolides

Ce document consolide le cahier des charges, le rapport de cadrage, le document
initial du projet et les huit workflows fonctionnels. Il decrit la cible produit
de Docomptia. Il ne doit pas etre utilise pour conclure qu'une fonction existe
deja: le code, les tests et l'historique Git restent la source de verite sur
l'etat reel de l'implementation.

## Vision

Docomptia est une plateforme SaaS francaise de gestion du cycle de vie des
factures. Sa valeur ne repose pas seulement sur l'OCR, mais sur l'enchainement
controle suivant:

```text
reception du document
-> conservation de l'original
-> extraction et qualification des donnees
-> correction humaine
-> validation metier
-> proposition comptable equilibree
-> export
-> archivage et audit
```

Le produit cible d'abord les factures fournisseurs des TPE, PME, associations
et cabinets comptables. Les factures clients, les connecteurs et les fonctions
SaaS avancees completent ensuite ce noyau.

Docomptia n'est pas une Plateforme Agreee. Le produit est un outil de traitement
interne et de preparation comptable qui pourra se connecter a une plateforme
agreee. Toute affirmation reglementaire doit etre reverifiee avant une mise en
production.

## Contexte Reglementaire A Revalider

Les documents sources indiquent le calendrier suivant:

- capacite de reception electronique pour les entreprises assujetties a partir
  du 1er septembre 2026;
- emission a partir du 1er septembre 2026 pour les grandes entreprises et ETI;
- emission a partir du 1er septembre 2027 pour les PME et microentreprises.

Une version du cahier simplifie la seconde etape en indiquant septembre 2027
pour l'emission. Cette divergence doit etre resolue avec les sources officielles
DGFiP et ministerielles avant tout developpement de conformite. Les formats cites
sont Factur-X, UBL 2.1 et CII, en lien avec EN 16931. Le FEC concerne l'export
comptable et ne remplace pas un format de facture electronique.

## Positionnement

Le benchmark source compare Zeendoc, Pennylane, Dext et Yooz. Le positionnement
recherche n'est pas de reproduire un ERP complet, mais de proposer un parcours
simple, modulaire et partiellement open source qui combine GED, OCR, correction,
validation et generation comptable pour de petites structures.

Les prix, nombres de clients, notes et statuts de certification des concurrents
sont des donnees de veille temporaires. Ils ne doivent pas guider une decision
technique sans verification recente.

## Acteurs

| Acteur | Responsabilite principale |
| --- | --- |
| Deposant | Transmettre un document et traiter les retours de correction |
| Operateur comptable | Verifier, corriger, classer et preparer la facture |
| Validateur | Valider, refuser ou demander une correction |
| Responsable comptable | Controler les ecritures et les exports |
| Administrateur | Configurer l'organisation, les comptes, les regles et les utilisateurs |
| Auditeur | Consulter les preuves, historiques et journaux sans modifier |

Les roles MVP retenus sont `ADMIN`, `OPERATEUR_COMPTABLE` et
`RESPONSABLE_COMPTABLE`. Un role de validateur ou de lecteur peut etre ajoute
lorsqu'un ticket fonctionnel l'exige.

## Priorites Produit

### Must - socle fonctionnel

- upload PDF ou image;
- conservation du document avant tout traitement automatique;
- OCR, champs extraits, score de confiance et correction manuelle;
- cycle de vie controle avec validation et refus;
- stockage PostgreSQL et MinIO;
- recherche et consultation des factures;
- isolation des donnees par organisation;
- authentification, autorisation et audit avant une exploitation reelle;
- erreurs metier explicites et absence de perte documentaire.

### Should - consolidation

- detection et decision de doublon;
- workflow de validation configurable;
- traitement OCR asynchrone et relancable;
- generation comptable dynamique et controle d'equilibre;
- export CSV puis FEC;
- tests d'integration, metriques et observabilite.

### Could - extensions

- factures clients;
- suivi des paiements et relances;
- comptabilite analytique;
- notifications avancees;
- application mobile ou scan mobile;
- connecteurs ERP, comptables et bancaires.

### Hors POC

- agrement propre comme Plateforme Agreee;
- e-reporting de production complet;
- archivage legal certifie complet;
- couverture reglementaire internationale;
- paiement bancaire automatique sans controle humain.

## Factures Fournisseurs

### Reception

Le canal MVP est l'upload manuel. Les canaux cibles sont:

- PDF ou image depuis l'interface;
- adresse email dediee;
- API ou webhook d'une Plateforme Agreee;
- scan mobile dans une phase ulterieure.

Le format Word apparait dans un workflow historique mais n'est pas necessaire au
MVP. Tous les canaux doivent converger vers le meme service metier.

Avant l'OCR, le backend doit:

1. valider le nom, la taille, le type et le contenu minimal du fichier;
2. creer une facture brouillon rattachee a l'organisation et au deposant;
3. stocker le fichier original;
4. enregistrer l'historique du statut;
5. lancer l'analyse sans rendre le document dependant du succes de l'OCR.

Une erreur technique ne doit jamais supprimer le brouillon ou le document deja
stocke.

### OCR Et Extraction

Les champs cibles sont:

- fournisseur;
- SIRET et numero de TVA;
- numero de facture;
- date de facture et date d'echeance;
- reference de commande;
- devise;
- montant HT, montant de TVA et montant TTC;
- IBAN ou informations de paiement lorsqu'ils sont disponibles;
- texte OCR brut;
- score de confiance global et, si possible, score par champ.

L'OCR transforme le document en texte. L'extraction metier transforme ensuite le
texte en champs structures. Un raffinement LLM peut completer les expressions
regulieres, mais il ne doit ni inventer une valeur ni remplacer les controles du
backend.

Une donnee absente, invalide ou incertaine reste `null`. Les valeurs brutes,
normalisees et corrigees doivent rester distinguables. Le moteur, sa version, la
date, le statut et le detail d'erreur doivent etre historisables.

L'utilisateur peut relancer l'OCR sur le fichier original. Une relance cree une
nouvelle tentative ou met a jour explicitement l'extraction selon le contrat du
ticket; elle ne duplique pas la facture.

### Fournisseur

L'upload ne depend pas d'un `supplierId`. Apres extraction, le fournisseur est
recherche dans l'organisation courante, prioritairement par:

1. SIRET;
2. numero de TVA;
3. identifiant fiable ajoute ulterieurement.

Le nom seul n'est pas une identite suffisante et n'est pas globalement unique.
Un fournisseur peut etre cree lorsqu'aucune correspondance fiable n'existe, sans
dupliquer un SIRET ou un numero de TVA deja connu dans la meme organisation.

### Doublons

La detection compare dans l'organisation courante:

- fournisseur;
- numero de facture;
- date;
- montant TTC;
- eventuellement l'empreinte du document.

Un doublon probable suspend la progression automatique. L'utilisateur peut
fusionner les documents, ignorer l'alerte ou rejeter le nouveau document. La
decision et son auteur sont historises.

### Correction Et Classement

L'operateur peut corriger les champs et rattacher la facture a un fournisseur,
un classeur, un dossier, un chantier ou une dimension analytique. Chaque
correction conserve:

- valeur avant;
- valeur apres;
- champ concerne;
- utilisateur;
- date;
- motif si le workflow l'exige.

Une correction ne doit pas effacer la valeur OCR brute.

### Comptabilisation Fournisseur

La proposition comptable depend:

- des montants valides;
- du fournisseur;
- du plan comptable de l'organisation;
- des regles d'imputation configurees;
- de la nature de la depense;
- des lignes de facture lorsqu'elles existent.

Une facture simple produit generalement une ou plusieurs charges au debit, une
TVA deductible au debit et une dette fournisseur au credit. Ce schema n'autorise
pas trois lignes codees en dur: le nombre de lignes et les comptes proviennent
des donnees et des regles.

Un avoir inverse les effets debit et credit selon les regles comptables. Une
ecriture doit respecter:

```text
somme(debits) = somme(credits)
```

Une ecriture desequilibree ne peut pas etre validee ou exportee.

### Validation

Selon la configuration de l'organisation, la facture peut etre validee
directement ou assignee a un validateur. Celui-ci peut:

- valider;
- refuser avec un motif obligatoire;
- demander une correction.

Le deposant ou l'operateur doit pouvoir consulter la decision et corriger la
facture. La validation metier et l'equilibre comptable sont deux controles
distincts. Une facture devient exportable uniquement lorsque les deux sont
satisfaits.

### Paiement, Export Et Archivage

Le paiement constitue une information de suivi et ne remplace pas le statut
documentaire ou comptable. Une facture exportable peut rejoindre un lot CSV ou
FEC. Apres un export reussi:

- un numero de piece est attribue;
- la facture est marquee exportee;
- le fichier et le lot sont conserves;
- l'action est journalisee;
- l'archivage peut rendre la facture accessible en lecture seule.

Une modification apres export est interdite. La correction cree une extourne et
une nouvelle ecriture corrigee.

## Factures Clients

Une facture client peut etre creee, importee ou dupliquee.

### Creation

1. Selectionner le client.
2. Ajouter les lignes, quantites, prix, remises et taux de TVA.
3. Calculer HT, TVA et TTC.
4. Renseigner echeance, conditions de paiement et mentions legales.
5. Previsualiser et controler la completude.
6. Generer le PDF puis Factur-X si cette option est activee.

### Import Et Duplication

Un import PDF, image, Factur-X ou format structure pre-remplit les champs et
reste corrigible. Une duplication conserve le client et les lignes pertinentes,
mais genere de nouvelles dates et un nouveau numero.

### Comptabilisation Client

La proposition comprend generalement le compte client au debit, les comptes de
produits au credit et la TVA collectee au credit. Les comptes et le nombre de
lignes restent dynamiques. L'ecriture doit etre equilibree avant emission.

### Emission

Les canaux cibles sont le telechargement, l'email, l'impression et une
Plateforme Agreee. La facture emise est suivie jusqu'au paiement, puis devient
exportable et archivable selon les regles.

## Cycle De Vie

La cible fonctionnelle utilise les statuts suivants:

| Statut | Sens |
| --- | --- |
| `A_TRAITER` | Document recu, traitement non commence |
| `EN_COURS` | Classification, OCR ou controle en cours |
| `ERREUR_OCR` | OCR impossible ou donnees insuffisantes |
| `A_VERIFIER` | Extraction disponible, controle humain requis |
| `REFUSEE` | Refus motive |
| `VALIDEE` | Validation metier obtenue |
| `EXPORTABLE` | Validation obtenue et ecriture equilibree |
| `EXPORTEE` | Export comptable reussi |
| `ARCHIVEE` | Lecture seule apres archivage |
| `EXTOURNEE` | Ecriture exportee annulee par une ecriture inverse |

Les codes Java, les valeurs en base et les donnees d'initialisation doivent etre
alignes. Les transitions sont centralisees dans un service metier; un endpoint
ne peut pas imposer arbitrairement un statut.

## Recherche Et GED

La recherche simple accepte un mot-cle. La recherche avancee permet de filtrer
par fournisseur ou client, numero, date, montant, statut, dossier, chantier,
classeur, compte, type de facture et export. Les resultats sont pagines,
triables et limites a l'organisation active.

La fiche document expose uniquement les donnees necessaires au frontend:

- document original et previsualisation securisee;
- donnees extraites et corrigees;
- ecriture et lignes comptables;
- statuts, commentaires et decisions;
- informations d'export;
- audit accessible selon les permissions.

Un document archive est consultable mais non modifiable.

## Export Comptable

L'utilisateur choisit une periode et un perimetre: organisation, type de
facture, chantier, dossier, classeur ou selection explicite.

Avant export, le backend controle:

- validation des factures;
- statut exportable;
- absence de doublon bloquant;
- comptes actifs et renseignes;
- TVA coherente;
- equilibre de toutes les ecritures;
- numerotation disponible;
- absence d'export precedent incompatible.

Un echec retourne un rapport detaille sans modifier les factures. Un succes
genere et stocke d'abord le fichier, puis marque les factures exportees dans une
transaction coherente. Le lot conserve auteur, date, periode, format, factures,
ecritures, controles, numeros de pieces et statut.

Le CSV personnalise est prioritaire pour le MVP. Le FEC est active lorsque le
format, les journaux, les numeros de comptes, les dates, les libelles et les
contraintes DGFiP sont completement definis et testes.

## Administration Metier

L'administrateur configure:

- informations legales, TVA, logo et numerotation de l'organisation;
- utilisateurs, roles, invitations, desactivation et permissions;
- plan comptable par saisie ou import CSV;
- correspondances fournisseur, client et TVA;
- regles d'imputation;
- workflow, seuils, validateurs et tampons;
- classeurs, dossiers, chantiers et champs personnalises;
- modeles PDF, mentions legales et conditions de paiement;
- connecteurs email, export, ERP, Plateforme Agreee et SEPA;
- audit, sessions, RGPD et export de donnees;
- plan SaaS, facturation, limites et changement d'offre.

Les fonctions indispensables au workflow comptable sont implementees avant les
fonctions commerciales SaaS.

## Dashboard

Le dashboard doit presenter:

- factures a traiter;
- factures a verifier;
- factures en attente de validation;
- factures exportables;
- alertes OCR, doublons et ecritures desequilibrees;
- volumes, montants, TVA et repartition par statut.

Les compteurs doivent etre filtres par organisation et correspondre aux memes
regles que les listes detaillees.

## Erreurs Et Cas Limites

| Cas | Comportement attendu |
| --- | --- |
| OCR faible | Score visible, verification manuelle, original conserve |
| OCR indisponible | Statut d'erreur, detail exploitable, relance possible |
| Doublon probable | Documents similaires et decision utilisateur historisee |
| Ecriture desequilibree | Export bloque, totaux et lignes concernes retournes |
| Facture refusee | Motif obligatoire et retour a la correction |
| Modification apres export | Extourne et nouvelle ecriture, jamais de modification directe |
| Droits insuffisants | Acces refuse sans fuite de donnees |
| Limite SaaS atteinte | Action bloquee sans perte du document |

## Donnees Metier Cibles

Le modele cible comprend progressivement:

- organisations, utilisateurs, roles et permissions;
- fournisseurs, clients et identifiants legaux;
- factures fournisseurs ou clients et lignes de facture;
- fichiers originaux et versions;
- extractions OCR, champs et corrections;
- statuts et historiques;
- alertes et decisions de doublon;
- commentaires et validations;
- plan comptable et regles d'imputation;
- ecritures et lignes comptables;
- dossiers, classeurs, chantiers et analytique;
- paiements et echeances;
- lots d'export, numeros de pieces et fichiers;
- archivage, extournes et audit.

Une table n'est ajoutee que lorsqu'un ticket fonctionnel en a besoin. Le MVP ne
doit pas creer tout le modele cible en une seule livraison.

## Exigences Non Fonctionnelles

### Performance

- action UI courante: cible inferieure a 2 secondes;
- API hors OCR: p95 inferieur a 500 ms pour la cible d'exploitation;
- OCR mono-page: objectif fonctionnel inferieur a 10 secondes;
- OCR jusqu'a 5 pages: cible d'exploitation p95 inferieure a 30 secondes;
- export de 500 ecritures: inferieur a 5 secondes.

Ces valeurs doivent etre mesurees sur un environnement et un corpus documentes.

### Disponibilite Et Reprise

- disponibilite cible: 99,5 %;
- RTO cible: 4 heures;
- RPO cible: 24 heures;
- sauvegardes quotidiennes separees de PostgreSQL et MinIO;
- procedure de restauration testee;
- conservation documentaire cible de 10 ans, a valider juridiquement.

### Securite Et Confidentialite

- HTTPS/TLS en transit et chiffrement adapte au repos;
- authentification JWT ou OAuth2 selon la decision d'architecture;
- autorisation par organisation et role;
- aucun acces transversal entre organisations;
- journalisation des acces et actions sensibles;
- aucune facture, donnee personnelle ou secret dans les logs;
- conformite RGPD, export et suppression selon les obligations applicables;
- secrets uniquement dans l'environnement ou un gestionnaire de secrets.

### Qualite Et Maintenabilite

- API REST documentee avec OpenAPI;
- services aux responsabilites separees;
- migrations versionnees lors d'un changement de schema;
- tests des transitions, controles comptables et cas d'erreur;
- composants OCR remplacables derriere une interface stable;
- observabilite des erreurs, latences et volumes;
- traitement asynchrone a introduire uniquement lorsque la charge le justifie.

## Architecture Retenue

| Composant | Responsabilite | Technologie |
| --- | --- | --- |
| Frontend | Interface et parcours utilisateur | React, TypeScript, Vite |
| Backend | API, metier, transactions et orchestration | Java 25, Spring Boot |
| OCR | Pretraitement, Tesseract et extraction | FastAPI, Python |
| Donnees | Entites et contraintes metier | PostgreSQL |
| Documents | Stockage objet | MinIO compatible S3 |
| Entree | Routage web et limite d'upload | Nginx |
| Local | Environnements reproductibles | Docker Compose |

La decision retenue est un backend metier modulaire et un service OCR separe.
Un monolithe complet et des microservices generalises ne sont pas retenus pour
le MVP.

## Definition De Termine

Une fonctionnalite est terminee lorsque:

- les criteres d'acceptation sont satisfaits;
- le contrat API est documente lorsqu'il change;
- les tests pertinents passent;
- les erreurs ne corrompent pas les donnees;
- la migration est fournie si le schema change;
- aucun secret, certificat ou fichier genere n'est commite;
- les logs restent exploitables sans exposer de facture;
- la documentation et l'historique sont mis a jour;
- la branche attend une revue humaine avant le push ou la fusion.
