# Profil et abonnement — KAN-313

## Parcours

- `/profile` : consultation du profil personnel depuis l'identité dans la barre latérale.
  La page est distincte de la navigation des paramètres de l'organisation.
- `/settings/billing` : catalogue, abonnement courant et consommation pour l'administrateur.
  Le contrôle MVP existant est conservé ; le backend reste responsable de l'autorisation.

## Données utilisées

| Endpoint GET | Usage |
| --- | --- |
| `/api/v1/users/me` | Prénom, nom, email, rôle et organisation du compte connecté |
| `/api/v1/subscription-plans` | Plans actifs, quotas et fonctionnalités |
| `/api/v1/organizations/current/subscription` | Abonnement, statut, prochaine échéance et consommation |

Le profil est rechargé à l'ouverture ; les identifiants utilisateur et organisation doivent
correspondre à la session. Un paramètre d'URL ne peut pas choisir une autre identité.
Les appels du catalogue et de l'abonnement sont indépendants, annulés au départ de la page,
et disposent chacun d'une nouvelle tentative. Un rafraîchissement masque les anciennes données.
Les erreurs serveur ne sont jamais affichées telles quelles. Un 401 réutilise l'expiration
de session existante.

Les réponses sont validées avant affichage : limites nulles ou entières non négatives,
dates calendaires valides, période ordonnée, compteurs non négatifs et codes de plans uniques.
Une limite `null` signifie illimité ; zéro reste une limite nulle. Une consommation atteinte
ou dépassée reste visible sans modifier son montant. Le mois affiché provient de `usage`,
et non de l'horloge du navigateur. Aucun décalage de fuseau n'est appliqué aux dates civiles.

`subscribed: false` avec les autres champs nuls produit « No current subscription ».
Un catalogue vide produit « No plans are available ». Un échec de lecture ne devient pas
une absence d'abonnement. Le statut retourné n'est pas remplacé arbitrairement par « Active ».
Le plan courant est déterminé par sa réponse dédiée, même s'il n'est plus dans le catalogue actif.

## Capacités absentes et périmètre

- KAN-241 reste nécessaire pour l'historique des paiements et les justificatifs SaaS.
  Son blocage Jira est documenté ; l'écran affiche une indisponibilité explicite.
- Aucun prix, cycle de facturation, quota de stockage, carte bancaire ou paiement fictif.
- Le PATCH technique de changement d'offre existe, mais ce ticket livre la consultation.
  Aucun changement de plan ni paiement n'est déclenché depuis cet écran.
- Le profil est en lecture seule. L'édition d'identité existante est réservée aux administrateurs
  dans Members ; aucune API d'édition personnelle commune aux rôles MVP n'est supposée.
- Photos, langue, fuseau et apparence personnels ne sont pas persistés par les contrats actuels.
- Les liens vers Notifications et Security réutilisent les écrans existants. KAN-374 et KAN-376
  suivent respectivement les préférences de notification et la sécurité encore indisponibles.

## Références Figma

Fichier `OIiZeI890EVI23MZpDpJnB`, page `405:484` (Settings) :

- Profil desktop `536:7980` / contenu `536:8162`, mobile `536:8285` / contenu `536:8314`.
- Billing desktop `526:7334` / contenu `526:7388`, mobile `526:7553` / contenu `526:7565`.
- Composants `530:7848` (User Profile), `523:7171` (Billing), `521:7200` (plan).

Les pages Prototype Flows et MVP ont également été inspectées. Les montants et consommations
de démonstration Figma sont remplacés par les valeurs réelles ou l'indisponibilité appropriée.

## Validation

Tests Playwright : `frontend/e2e/profile-billing.spec.ts`. Ils couvrent les contrats de lecture,
quotas illimités/nuls/atteints/dépassés, données invalides, chargement, vide, erreurs, droits,
session expirée, navigation clavier et rendu à 1440, 768 et 390 px.
