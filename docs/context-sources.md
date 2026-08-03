# Sources Du Contexte Agent

Ce registre explique d'ou vient le contexte produit consolide et comment le
maintenir. Les fichiers binaires originaux ne sont pas necessaires a l'execution
de l'agent: leur contenu utile est transcrit dans les documents Markdown du
depot.

## Regle De Lecture

L'agent lit les sources dans cet ordre:

1. `AGENTS.md` pour les regles de code et de Git;
2. ticket et epic Jira pour le besoin courant;
3. `docs/project-decisions.md` pour les decisions validees;
4. `docs/product-requirements.md` pour la cible produit;
5. `docs/backend-business-workflows.md` pour les flux detailles;
6. documentation technique dans `docs/`;
7. code, tests, schema et historique Git pour l'etat reel.

Une exigence cible ne prouve pas qu'elle est implementee. Une implementation
existante ne prouve pas qu'elle satisfait la cible. L'agent compare les deux et
limite son changement au ticket.

## Documents Sources Analyses

### Rapport de cadrage Docomptia

- titre: `ERRAGRAGY_MOHAMED-NACER_Groupe12_RapportDeCadrage.pdf`;
- longueur: 34 pages;
- periode: annee universitaire 2025-2026;
- contenu: problematique, marche, priorites, architecture, exigences, gestion de
  projet, POC, infrastructure, objectifs de service et risques;
- transcription principale: `docs/product-requirements.md`;
- decisions techniques: `docs/project-decisions.md`.

Le rapport est la source de cadrage la plus recente parmi les documents fournis.
Ses affirmations reglementaires ou concurrentielles restent a verifier avant une
decision de production.

### Cahier des charges Facturation Electronique

- titre: `Cahier_des_Charges_Facturation_Electronique.docx`;
- version: 1.0, mai 2026;
- les copies `docsContext` et `Downloads` analysees sont identiques;
- contenu: besoins clients et fournisseurs, OCR, comptabilite, validation,
  export, archivage, performance, securite, technologies et perspectives;
- transcription principale: `docs/product-requirements.md`.

### Document initial Projet Fil Rouge

- titre: `Projet Fil Rouge Facturation Electronique.pdf`;
- longueur: 6 pages;
- contenu: vision input/traitement/output, OCR, ecriture comptable, archivage,
  cycle de vie, export et separation noyau open source / produit SaaS;
- role: source historique de la vision, completee par le cahier et le rapport.

## Diagrammes De Workflow Analyses

Les huit images originales ont ete relues. Leur contenu est transcrit dans
`docs/backend-business-workflows.md` et complete par les exigences ci-dessous.

### Diagramme 1 - entree, onboarding et dashboard

Le diagramme couvre:

- inscription ou connexion;
- creation ou selection d'organisation;
- choix du plan Starter, Business ou Pro;
- informations legales;
- plan comptable;
- classeurs, fournisseurs, clients, chantiers et dossiers;
- roles, permissions, validation et formats d'export;
- dashboard avec files de travail, alertes et indicateurs;
- acces aux modules fournisseur, client, GED, export, administration et billing.

Transcription: workflow 1 et workflow 7.

### Diagramme 2 - facture fournisseur

Le diagramme couvre:

- upload, email, Plateforme Agreee et scan futur;
- creation du document, detection du type et lisibilite;
- pretraitement, OCR et extraction des champs;
- doublons et decision utilisateur;
- correction, fournisseur, classement et analytique;
- proposition comptable dynamique et controle d'equilibre;
- assignation, validation, refus ou correction;
- paiement, export, numerotation et archivage.

Transcription: workflow 2, workflow 4 et workflow 8.

### Diagramme 3 - facture client

Le diagramme couvre:

- creation, import ou duplication;
- client, lignes, TVA, remise, echeance et mentions legales;
- PDF et Factur-X;
- ecriture client, produits, TVA collectee et controle d'equilibre;
- impression, plateforme, telechargement ou email;
- emission, paiement, export et archivage.

Transcription: workflow 3.

### Diagramme 4 - cycle de vie

Le diagramme couvre les transitions:

```text
A_TRAITER
-> EN_COURS
-> A_VERIFIER ou ERREUR_OCR
-> VALIDEE ou REFUSEE
-> EXPORTABLE
-> EXPORTEE
-> ARCHIVEE ou EXTOURNEE
```

Il impose correction par le deposant, motif de refus, ecriture equilibree,
lecture seule apres archivage et extourne apres export.

Transcription: workflow 4.

### Diagramme 5 - recherche et GED

Le diagramme couvre:

- recherche simple par mot-cle;
- filtres fournisseur/client, date, montant, statut, dossier, numero, compte et
  export;
- fiche document avec original, extraction, ecriture, historique, commentaires,
  validation, telechargement et audit;
- lecture seule d'un document archive.

Transcription: workflow 5.

### Diagramme 6 - export comptable

Le diagramme couvre:

- periode et perimetre;
- liste des factures eligibles;
- controles de numerotation, doublon, TVA, comptes, equilibre et validation;
- rapport d'erreurs sans changement de statut;
- CSV, FEC ou rapport PDF;
- telechargement, marquage, numeros de pieces, journalisation et archivage.

Transcription: workflow 6.

### Diagramme 7 - parametres SaaS

Le diagramme couvre neuf familles:

1. organisation: informations legales, TVA, logo et numerotation;
2. utilisateurs et roles: invitation, roles, permissions et desactivation;
3. plan comptable: import CSV, comptes, mappings tiers/TVA et imputation;
4. workflows: circuit fournisseur, seuils, validateurs et tampons;
5. classeurs et dossiers: classeur, chantier, dossier et champs personnalises;
6. modeles: PDF, mentions legales et conditions de paiement;
7. connecteurs: email, export, Plateforme Agreee, ERP et SEPA;
8. securite et audit: journal, sessions, authentification et RGPD;
9. abonnement: plan, facturation, limites et changement d'offre.

Transcription: workflow 7.

### Diagramme 8 - erreurs et cas limites

Le diagramme couvre:

- OCR faible et correction;
- doublon avec fusion, poursuite ou rejet;
- ecriture desequilibree et export bloque;
- refus motive et retour a correction;
- modification apres export par extourne;
- droits insuffisants;
- limite d'abonnement et changement de plan.

Transcription: workflow 8.

## Contexte Issu Des Echanges De Conception

La conversation de conception n'est pas transmise brute a l'agent. Ses decisions
stables sont normalisees dans `docs/project-decisions.md`, notamment:

- choix Spring Boot + FastAPI OCR;
- Tesseract et raffinement LLM optionnel;
- brouillon et fichier avant OCR;
- upload sans fournisseur obligatoire;
- absence de valeurs artificielles;
- fournisseur identifie dans une organisation;
- statuts Java alignes avec la base;
- endpoints par etape;
- generation comptable dynamique;
- configuration par l'administrateur;
- profils Docker et Spring;
- regles de commits et exclusions reseau.

Une nouvelle decision prise en discussion doit etre ajoutee a ce journal avant
d'etre consideree comme contexte durable.

## Limites Et Verification

- les images et documents originaux ne sont pas lus a chaque ticket;
- les syntheses Markdown sont la version operationnelle pour l'agent;
- les dates legales, certifications, prix et statistiques de marche peuvent
  evoluer et doivent etre verifies dans des sources officielles;
- les performances sont des objectifs, pas des mesures acquises;
- le rapport de cadrage peut decrire une fonction comme presente alors que le
  code a change depuis sa redaction;
- le ticket doit toujours etre compare au code et aux tests.

## Protocole De Mise A Jour

Lorsqu'une source ou une decision change:

1. identifier le document et la section impactes;
2. mettre a jour la synthese Markdown, pas seulement le binaire;
3. indiquer si la decision precedente est remplacee ou abandonnee;
4. mettre a jour les workflows et exigences lies;
5. adapter la liste `codex.contextFiles` si un nouveau document devient
   obligatoire;
6. faire relire le changement avant de l'utiliser pour des tickets autonomes.
