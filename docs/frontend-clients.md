# Consultation Des Clients — KAN-301

## Parcours

- `/clients` : liste paginée (8 clients), raison sociale, nom commercial,
  SIRET, TVA, statut actif/inactif et dernière mise à jour.
- `/clients/:customerId` : fiche Overview, identité légale, coordonnées et
  dates du profil. Le retour à la liste conserve sa page.
- La visibilité des colonnes est réglable localement avec les composants
  shadcn Popover et Checkbox existants.

Références Figma, page **15 — Clients** :

- [Clients / Desktop / 1440](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=365-1994).
- [Client Detail / Overview / Desktop 1440](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=371-604).

Les couleurs sémantiques, espacements et styles de cartes utilisent les tokens
déjà présents dans `frontend/src/index.css`. Le shell actuel est conservé.

## Contrat Et Isolation

Les seules requêtes de ce module sont `GET /api/v1/customers?page&size` et
`GET /api/v1/customers/{id}` (KAN-213). Le frontend utilise le client authentifié
commun, sans paramètre d'organisation. Le backend résout l'organisation depuis
l'utilisateur connecté et contrôle `VIEW_CUSTOMERS`.

Les données restent dans l'état local de la page. Les requêtes sont annulées
à la navigation ; l'identité utilisateur et l'organisation font partie de la
clé de requête. Un refus 403 ou un client hors organisation (404) ne restitue
pas de profil précédent. Un 401 déclenche le traitement commun de session.

Une liste retournant 404, 405 ou 501 affiche un module indisponible, sans
résultats ni parcours simulé. Les erreurs temporaires peuvent être réessayées.

## Limites Du Périmètre Livré

Le contrat ne propose pas de recherche ni de filtre de statut. Ces contrôles
restent désactivés, avec une explication visible ; aucune recherche limitée à
la page ne prétend couvrir tout le répertoire.

Les projets liés, volumes de factures, revenus, comptabilité et audit client
ne sont pas exposés. Les zones correspondantes restent explicitement
indisponibles. Les dates du profil ne sont pas présentées comme un journal
d'activité. Aucun montant, compteur, contact ou identifiant n'est inventé.

KAN-301 couvre la consultation. Les actions de création/modification restent
désactivées dans cette interface, même si le backend possède des endpoints
d'écriture. La désactivation et les autres onglets métier sont hors périmètre.

## Vérification

`frontend/e2e/clients.spec.ts` couvre les champs réels, la navigation clavier,
la pagination, les colonnes, les états vides/chargement/erreur, les refus
d'accès et les trois rôles actuels à 1440, 768 et 390 px. Les données de
démonstration sont exclusivement définies dans les tests.
