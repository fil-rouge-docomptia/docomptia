# Règles comptables — KAN-287

La route `/accounting/rules`, accessible depuis l’onglet Rules de la comptabilité,
permet de consulter les règles de l’organisation et de modifier leurs comptes.

## Référence visuelle

[Accounting / Rules / Desktop 1440, 292:1851](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=292-1851)
sur la page `11 — Accounting` (`283:972`). Les pages Prototype Flows (`617:2`) et
Responsive (`573:2`) ont également été inspectées ; elles ne proposent pas de variante
dédiée à cet écran. La liste et l’éditeur reprennent les proportions 400/688 px, les
espacements, les tokens et les composants existants. Les deux panneaux s’empilent sur
petit écran. Les sélecteurs de compte réutilisent le combobox avec recherche du projet.

## Contrat et comportement

- `GET /api/v1/accounting-rules` : toutes les règles de l’organisation connectée,
  triées par priorité croissante puis identifiant. Les états actif/inactif et la
  configuration complète/incomplète proviennent de la réponse.
- `GET /api/v1/chart-of-accounts?page=N&size=100` : toutes les pages sont chargées
  avant d’autoriser la modification. Le chargement de la première page seule ne suffit
  pas à afficher un plan complet. Seuls les comptes actifs sont sélectionnables.
- `PATCH /api/v1/accounting-rules/{id}` : seuls les champs effectivement modifiés
  parmi `expenseAccountId`, `vatAccountId` et `supplierAccountId` sont envoyés.
  Les valeurs inchangées et les champs non gérés ne sont pas envoyés.
- Le numéro et le libellé d’un compte inactif restent visibles dans une configuration
  existante. Une configuration incomplète est signalée sans inventer de compte.
- La liste n’est mise à jour et le succès annoncé qu’après une réponse réussie du
  backend. Pendant la sauvegarde, les champs et le bouton sont désactivés ; une garde
  supplémentaire évite les doubles soumissions.
- La recherche locale, le filtre d’activité et la règle sélectionnée sont conservés
  dans les paramètres `query`, `status` et `rule`. Une référence explicite introuvable
  ne sélectionne jamais une autre règle silencieusement.
- Les requêtes sont annulées au démontage. Un changement d’utilisateur, de rôle ou
  d’organisation invalide les règles affichées et l’éditeur précédent.

Les trois rôles MVP consultent les règles ; seul ADMIN dispose du formulaire d’édition,
conformément à la sécurité existante et à l’exception RBAC demandée. Les réponses 403
restent contrôlées par le serveur. Aucun nouveau mécanisme RBAC n’est ajouté.

## États et limites

Chargement des règles et du plan, liste vide, recherche sans résultat, règles absentes,
erreurs réseau avec nouvelle tentative, lecture seule et absence d’accès possèdent des
états explicites. Une erreur de chargement du plan conserve les affectations existantes.
Les erreurs de sauvegarde 400/403/404/500 conservent le brouillon sans annoncer un succès.
Un refus 403 ou une règle supprimée 404 bloque une nouvelle sauvegarde jusqu’au
rechargement. Une réponse 401 utilise le mécanisme existant de fin de session.

La priorité numérique existe en base mais n’est pas exposée par le DTO actuel.
Le frontend affiche la valeur lorsqu’elle est fournie, sinon « Priority unavailable » ;
il ne transforme pas l’index de liste en fausse priorité. L’exposition de ce champ par
le backend reste nécessaire pour satisfaire complètement le critère correspondant.

L’API actuelle ne permet pas de créer, importer, dupliquer, supprimer, activer ou
désactiver les règles, ni de modifier leurs conditions ou priorités. Les actions
création/import/test restent désactivées. Les conditions, journaux, nombres de factures
correspondantes et résultats de simulation de Figma ne sont pas fabriqués. Le formulaire
se limite aux trois affectations comptables réellement modifiables.

## Vérification

`frontend/e2e/accounting-rules.spec.ts` couvre les contrats HTTP authentifiés, toutes les
pages du plan, la confirmation différée de sauvegarde, les états d’erreur, les rôles,
les comptes inactifs/manquants, la sélection par URL, la navigation clavier et les
largeurs 1440, 768 et 390 px. Les requêtes de ces tests navigateur sont simulées.
