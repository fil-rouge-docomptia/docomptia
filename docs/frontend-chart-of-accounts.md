# Consultation du plan comptable — KAN-288

La route protégée `/accounting/accounts` est accessible depuis l'onglet Chart of accounts
de la section Accounting. Elle consulte les comptes de l'organisation authentifiée,
sans cache partagé ni données de démonstration en production.

## Référence visuelle

[Chart of Accounts / Desktop 1440](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=312-850),
page `11 — Accounting` (`283:972`). Les pages `23 — Prototype Flows` (`617:2`) et
`22 — Responsive` (`573:2`) ne contiennent pas de variante dédiée à cette consultation.
Les tokens existants, Inter, Lucide, boutons, onglets, badges et tableau shadcn sont réutilisés.
Sur mobile, le tableau défile horizontalement dans une région accessible au clavier ;
la page et les filtres restent dans la largeur disponible. Les actions futures d'import/export
sont masquées aux petites largeurs ; Add account reste accessible à l'administrateur.

## Contrat et périmètre MVP

- `GET /api/v1/chart-of-accounts?page=0&size=100` renvoie une page Spring : `content`,
  `number`, `size`, `totalElements`, `totalPages`. Les pages commencent à zéro.
- Le frontend réutilise `ChartOfAccount` : `accountId`, `accountNumber`, `accountLabel`,
  `accountType`, `active`. Le type est un texte libre du backend, affiché sans le réinterpréter.
- L'organisation est déterminée par la session serveur, via `CurrentUserService` et
  `findByOrganizationOrganizationId`. Aucun identifiant d'organisation de l'URL frontend
  n'est envoyé à l'API. Les trois rôles MVP peuvent consulter le plan ; aucun nouveau RBAC
  n'est ajouté, conformément à l'exception demandée.
- Le serveur impose un tri par numéro puis identifiant et ne propose pas de recherche.
  Le frontend charge donc **toutes les pages** avant de rechercher, filtrer, trier et paginer
  localement par huit comptes. Une erreur sur une page invalide le chargement entier :
  aucun résultat partiel n'est présenté comme complet. Une nouvelle tentative repart de zéro.
- Cette stratégie convient au MVP. Pour les plans volumineux, prévoir une évolution backend
  avec recherche, filtres et tri avant pagination ; aucun contrat backend n'est changé ici.

## Navigation, accessibilité et états

`query`, `type`, `status`, `sort`, `direction` et `page` conservent la vue dans l'URL.
La recherche porte sur le numéro et le libellé, sans distinction de casse ou d'accent,
avec une limite de 200 caractères. Les filtres se combinent ; les types proviennent du plan.
Le tri porte sur numéro, libellé, type ou statut, avec ordre croissant/décroissant et critères
secondaires stables. Les en-têtes exposent `aria-sort` et sont activables au clavier.
Changer un filtre ou le tri revient à la première page. Une page invalide vaut 1 ; une page
au-delà de la fin affiche la dernière page disponible. Les filtres/colonnes inconnus sont ignorés.

Chargement complet, plan vide, recherche sans résultat, erreur réseau/serveur avec nouvelle
tentative, accès refusé (403) et service indisponible (404/405/501) sont distingués.
Une réponse 401 utilise la fin de session existante. Les requêtes sont annulées à la sortie
et les données invalidées au changement d'utilisateur, d'organisation ou de rôle.
Les comptes inactifs restent visibles et portent un badge textuel explicite ; aucun
interrupteur ne suggère une modification dans cet écran de consultation.

## Suites et écarts documentés

Les catégories et compteurs d'usage Figma ne figurent pas dans le DTO et sont omis.
La sélection en lot n'est pas proposée sans action associée.
[Création, modification et désactivation](frontend-account-management.md) sont disponibles
via KAN-289. L'import relève de KAN-290/KAN-291 et reste désactivé. L'export du plan est
hors périmètre. Les trois onglets Entries, Rules (KAN-287) et Chart of accounts sont
disponibles et permettent de naviguer entre les écrans comptables, y compris au clavier.

## Vérifications

`frontend/e2e/chart-of-accounts.spec.ts` couvre la recherche et le tri au-delà de la première
page API, les requêtes authentifiées, l'absence de paramètre d'organisation, pagination,
filtres combinés, URL et retour navigateur, clavier, réponses différées, rejet des données
partielles, nouvelle tentative, erreurs, expiration de session, changement d'organisation,
réponses obsolètes et rendus à 1440, 768 et 390 px pour les rôles existants.
L'isolation côté serveur est vérifiée par lecture du contrat et des tests backend existants ;
les tests frontend utilisent des réponses API contrôlées et ne remplacent pas ces tests backend.
