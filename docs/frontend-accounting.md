# Consultation des écritures comptables — KAN-284 / KAN-355

La route `/accounting` consulte les écritures de l'organisation authentifiée. Elle remplace
le placeholder comptable avec une liste paginée, une recherche, des vues d'équilibre et
un détail en lecture seule. Aucun jeu de données de démonstration n'est chargé en production.

## Référence visuelle

[Accounting / Entries / Desktop 1440](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=283-973),
page `11 — Accounting` (`283:972`). La page `23 — Prototype Flows` (`617:2`) a également
été inspectée, notamment le parcours Accounting Export. Le tableau utilise les tokens et
les composants existants : Inter, bordures, badges, boutons, table et panneau latéral shadcn.
Sur petit écran, seuls les tableaux défilent horizontalement ; les totaux restent lisibles.

## Contrat backend ajouté par KAN-355

- `GET /api/v1/accounting-entries?page=0&size=8&query=achat&balanced=false&status=CORRECTIVE`
  renvoie une page Spring (`content`, `number`, `size`, `totalElements`, `totalPages`).
- `GET /api/v1/accounting-entries/{id}` renvoie une écriture avec le même format d'élément.
- Un élément contient `invoiceId`, `invoiceNumber`, `supplierName`, `currencyCode`,
  `invoiceStatus` et `entry` (le DTO comptable existant avec ses lignes, totaux décimaux,
  équilibre et `reversedAccountingEntryId`).
- Le tri est fixe : date d'écriture décroissante, puis identifiant décroissant.
- `page` commence à 0 ; `size` vaut 20 par défaut et doit être compris entre 1 et 100.
- `query` est optionnel (200 caractères maximum), normalisé sans distinction de casse,
  et cherche une sous-chaîne littérale du numéro d'écriture, libellé, numéro de facture ou
  raison sociale du fournisseur. `%` et `_` ne sont pas des jokers.
- `balanced` est un booléen optionnel. Le filtre est calculé en base avant pagination avec
  les mêmes sommes débit/crédit que le mapper. `status` accepte `GENERATED`, `REVERSAL`
  ou `CORRECTIVE`. Les filtres sont combinables.
- L'organisation provient exclusivement de la session serveur. Aucun paramètre
  d'organisation n'est envoyé par le frontend ni utilisé pour élargir la requête.
- La sécurité réutilise `MANAGE_ACCOUNTING_ENTRIES` et les trois rôles MVP existants.
  Aucun nouveau mécanisme RBAC n'est introduit.
- Erreurs : 400 (paramètres invalides), 401 (session absente/expirée), 403 (accès refusé),
  404 (écriture absente ou appartenant à une autre organisation).

Les lectures ne modifient ni schéma, ni génération, ni corrections, ni export.
Les extournes et écritures correctives sont listées avec leurs propres identifiants et lignes.
Le numéro d'écriture ouvre le détail exact ; le lien de facture ouvre la fiche existante.

## Navigation et états

Les paramètres frontend `page` (commence à 1), `query`, `balanced`, `status` et `entry`
conservent la vue au rechargement et lors des retours navigateur. Modifier les filtres
revient à la première page. Les valeurs non supportées sont ignorées avant l'appel API.
Le changement d'identité ou d'organisation invalide les données affichées ; les réponses
obsolètes sont ignorées et les requêtes annulées au changement de contexte.

Chargement, liste vide, recherche sans résultat, page hors limites, nouvelle tentative,
accès refusé et détail introuvable possèdent des états distincts. Une API de liste absente
(404, 405 ou 501) est signalée comme indisponible, sans afficher un faux résultat vide.
Une réponse 401 utilise le mécanisme existant de fin de session. Le panneau restitue le
focus au bouton d'ouverture à sa fermeture. Les vues d'équilibre et la densité exposent
leur sélection aux technologies d'assistance.

## Écarts volontaires et périmètre restant

Le journal et le statut d'export propre à chaque écriture ne sont pas exposés dans le
modèle actuel. Le tableau affiche donc le type réel d'écriture et une colonne explicitement
nommée « Invoice status ». Le statut d'une facture exportée ne prouve pas que son extourne
ou sa correction a été exportée. Aucun journal `ACH`, compteur ou statut d'export n'est inventé.
Les filtres de journal/date, vues d'export, sélection en lot et personnalisation de colonnes
ne font pas partie de ce contrat minimal.

Les boutons de création/export et les onglets Rules/Chart of accounts restent désactivés :
ils appartiennent aux tickets suivants. Les écritures de la liste sont consultées en lecture
seule ; les corrections existantes restent accessibles depuis la fiche facture.

## Validation

- `frontend/e2e/accounting.spec.ts` couvre lecture, requêtes authentifiées, filtres,
  pagination, réponses différées, retour navigateur, états d'erreur, extourne, clavier et
  rendu à 1440, 768 et 390 px.
- `AccountingEntryReadIntegrationTest` couvre les vraies requêtes HTTP avec JWT, isolation,
  pagination, filtres combinés, montants, extourne, erreur 404 et validation des paramètres.
- Les tests backend sont exécutés sur H2 en mémoire dans une copie temporaire du projet,
  sans compilation dans le répertoire de l'application en cours ni redémarrage de service.
