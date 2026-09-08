# Génération et téléchargement d'export — KAN-294

Le parcours `/exports/new` se termine par une génération réelle, son résultat et le
téléchargement du fichier conservé. Le complément backend KAN-359 ajoute
`POST /api/v1/accounting-exports/generate`, documenté dans [backend.md](backend.md).
Les anciens endpoints qui exportent toute une période ne sont pas utilisés ici.

## Références Figma

Fichier Docomptia :

- [Generating, 631:38157](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=631-38157), carte `631:38161`.
- [Success, 631:38176](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=631-38176), carte `631:38182`.
- [Failed, 341:15375](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=341-15375), carte `346:14484`.

Cartes de 800 px maximum, marges internes 24/32 px, titres 18/28 px, rayon 8 px,
alertes bleue, verte et rouge, informations du fichier et actions responsives.
Réemploi des tokens, cartes, alertes, boutons, Progress et icônes Lucide existants.

L'API synchrone ne fournit pas de progression chiffrée ni de rapport annexe :
indicateur indéterminé, aucun pourcentage, nombre traité ou rapport inventé.
Le résultat reprend l'identifiant réel du lot, son auteur, sa date, son format,
son nombre de factures et le nom/taille du fichier. Aucun montant potentiellement
périmé issu de la préparation n'est présenté comme résultat de génération.

## Comportement

- La dernière confirmation ouvre l'action **Generate export**. Un seul POST
  authentifié est envoyé avec le format, la période et les identifiants confirmés.
- La préparation n'est pas une réservation : le backend revalide au moment de
  générer et sérialise les exports d'une organisation. Il renvoie son reçu après
  commit. Aucun état exporté n'est affiché avant cette réponse.
- Une réponse portant sur un autre lot de factures, format ou organisation, ou
  sans métadonnées valides, ne produit pas de succès dans l'interface.
- 400/403/404/405/409/501 présentent le refus. Les contrôles 409 sont détaillés par
  facture avec liens ; 400/409 permettent de modifier et recharger la sélection.
- Réseau, 500 et réponse incohérente présentent un résultat **non confirmé**.
  L'export peut avoir abouti : consulter l'historique avant une nouvelle tentative.
  Aucun renvoi automatique, aucune affirmation de rollback dans ce cas.
- Quitter la génération n'annule pas le travail du serveur ; un message le précise.
  Les réponses tardives sont ignorées après démontage ou changement de contexte.
- **Download file** réutilise le téléchargement authentifié de l'historique.
  Doubles téléchargements simultanés bloqués ; aucun nouveau POST de génération.
  403/404/500 restent près du bouton, sans effacer le succès du lot ; 401 ferme la
  session. Le fichier n'est proposé au navigateur qu'après réception de ses octets.
- **View export** ouvre `/exports?query=<id>#export-history` et relit l'historique.
  Un fichier archivé reste téléchargeable selon les permissions backend existantes.
- **Create another export** efface le résultat et la sélection, puis relit les
  candidats. URL ou rechargement ne peuvent fabriquer un succès. Aucun nouveau RBAC.

## Fichiers et vérification

`ExportReview.tsx` gère l'action ; `ExportGenerationResult.tsx` présente les états.
`DownloadExportButton.tsx` est partagé avec `ExportHistoryTable.tsx`.
`services/exports.ts` et `types/export.ts` portent le contrat du reçu.

`e2e/export-generation.spec.ts` couvre CSV/FEC, payload et authentification,
attente, doubles soumissions, reçus incohérents, refus, réseau, permissions MVP,
expiration de session, téléchargement réel des octets simulés, historique archivé,
retours et rendus à 1440/768/390 px. Les tests précédents de préparation et
historique restent actifs. Les tests backend exercent les vraies transactions,
la concurrence et les rollbacks dans une base H2 isolée, sans redémarrer le service
local. Les tests navigateur utilisent les réponses API contrôlées par Playwright.

Validation de livraison : lint et build frontend réussis, 93 tests ciblés exports
réussis puis 30 tests de génération après ajustement Figma, suite frontend complète
387/387, backend 517/517. Captures des trois états relues aux trois largeurs, ainsi
que les états permission refusée et résultat incertain. Le build signale toujours
l'avertissement préexistant sur les bundles de plus de 500 kB.
