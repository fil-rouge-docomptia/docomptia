# Intégrations — préparation frontend KAN-314

## Périmètre livré

Depuis `staging` au commit `5d7e770`, la page `/integrations` présente les familles
de la maquette : logiciels comptables, canaux de réception et outils développeur.
Les fiches `/integrations/:integrationId` expliquent les capacités indisponibles.
Les options proviennent de Figma ; ce sont des informations de présentation, pas
un catalogue retourné par une API ni un état des connexions de l'organisation.

L'option Generic FEC / CSV renvoie au centre d'export existant. Elle ne prétend pas
connecter un logiciel externe et réutilise les contrôles du parcours d'export.
Le contrôle ADMIN MVP de la navigation est appliqué aussi aux accès directs.
Les autres rôles voient un refus d'accès ; le RBAC reste hors périmètre selon la
dérogation utilisateur.

## Blocage fonctionnel — KAN-384

Aucun endpoint de catalogue, configuration, stockage de secrets ou test de
connexion n'existe dans la base inspectée. Aucun contrat réseau n'est inventé.
L'interface ne collecte aucun secret et n'expose pas de wizard pour les options
indisponibles, conformément à l'annotation Figma « Available integrations only ».
Les actions Configure, Test connection et Disconnect sont désactivées et expliquées.
Les paramètres d'URL ne peuvent pas forcer une étape ou un état de connexion.

Le parcours Information → Configuration → Test Connection → Success **reste à
implémenter après le backend** : cette préparation ne satisfait pas encore les
critères d'acceptation de bout en bout de KAN-314. KAN-384 suit le contrat et le
backend manquants ; il faut sélectionner le premier connecteur avant son développement.
KAN-366 traite séparément la réception simulée ; KAN-367/KAN-373 concernent la
Plateforme Agréée et ne sont pas remplacés par ces écrans.

Il n'y a aucun statut Connected, date de synchronisation, activité, adresse email
de réception ou résultat de test fictif. L'absence de capacité est distincte d'un
catalogue vide ou d'un échec réseau. Aucun chargement artificiel ni bouton de
nouvelle tentative sans opération réelle n'est ajouté.

## Références Figma

Fichier `OIiZeI890EVI23MZpDpJnB`, page `388:2` :

- Catalogue desktop `388:3`, contenu `388:5`.
- Détail desktop `394:515`, contenu `394:517`.
- Étapes consultées : `394:20020`, `394:20043`, `394:20066`, `394:20089`.
- Aucun écran Integrations dans les pages Prototype Flows, MVP et Responsive
  inspectées. Les largeurs 768 et 390 px suivent les patterns du projet.

Composants existants : PageHeader, Card, Button, Badge et Alert. Cartes avec
espacement 12 px, padding 20 px et rayon 8 px ; détails avec padding 24 px et
rayon 12 px. Les statuts de démonstration Figma sont remplacés par l'indisponibilité.

## Validation

`frontend/e2e/integrations.spec.ts` couvre les huit options, les accès directs,
les identifiants inconnus, les paramètres d'URL, l'absence de requêtes inventées
et de collecte de secrets, le lien d'export, la session expirée, le clavier et
les rendus 1440/768/390 px. Les scénarios backend ne sont pas simulés comme livrés.

Validation du 13 septembre 2026 : lint et build réussis ; 26 tests ciblés réussis.
Les captures du catalogue, des fiches, du refus d'accès et de l'option inconnue
ont été inspectées, dont les rendus desktop, tablette et mobile.
La suite complète compte 763 succès et 4 échecs préexistants, reproduits séparément
sur une copie de `staging` au commit `5d7e770` sans les changements KAN-314 :

- `invoice-upload.spec.ts` : deux attentes omettent le statut `ERREUR_TRAITEMENT`.
- `invoices.spec.ts` : deux attentes ne correspondent plus au texte et à l'action
  d'approbation de la fiche facture.

Ces tests de facturation restent à réconcilier avec le comportement attendu dans
un suivi distinct. Le build signale aussi l'avertissement existant de taille du bundle.
