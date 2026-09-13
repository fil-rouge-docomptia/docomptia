# Écritures comptables — consultation et saisie frontend

La route `/accounting` consulte les écritures de l'organisation authentifiée. Elle remplace
le placeholder comptable avec une liste paginée, une recherche, des vues d'équilibre et
un détail avec saisie des écritures non exportées. Aucun jeu de données de démonstration n'est chargé en production.

## Référence visuelle

[Accounting / Entries / Desktop 1440](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=283-973),
page `11 — Accounting` (`283:972`). La page `23 — Prototype Flows` (`617:2`) a également
été inspectée, notamment le parcours Accounting Export. Le tableau utilise les tokens et
les composants existants : Inter, bordures, badges, boutons, table et panneau latéral shadcn.
Sur petit écran, seuls les tableaux défilent horizontalement ; les totaux restent lisibles.

## Contrat initial ajouté par KAN-355 (enrichi par KAN-386)

- `GET /api/v1/accounting-entries?page=0&size=8&query=achat&balanced=false&status=CORRECTIVE`
  renvoie une page Spring (`content`, `number`, `size`, `totalElements`, `totalPages`).
- `GET /api/v1/accounting-entries/{id}` renvoie une écriture avec le même format d'élément.
- Un élément contient `invoiceId`, `invoiceNumber`, `supplierName`, `currencyCode`,
  `invoiceStatus` et `entry` (le DTO comptable existant avec ses lignes, totaux décimaux,
  équilibre et `reversedAccountingEntryId`).
- Le tri par défaut est la date décroissante ; KAN-386 ajoute les champs de tri et filtres décrits plus bas.
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

Le journal, le statut d’export propre et les diagnostics viennent de KAN-386. Les actions
Create entry, ajout/édition/retrait de lignes, extourne et corrective sont intégrées.
L’export d’écritures, la sélection en lot, l’affectation du journal et le passage explicite
à Ready attendent leurs contrats backend (KAN-389/390). Le bouton Export entries reste
indisponible. Les onglets [Rules](frontend-accounting-rules.md) et
[Chart of accounts](frontend-chart-of-accounts.md) conservent leurs parcours existants.

## Validation

- `frontend/e2e/accounting.spec.ts` couvre lecture, requêtes authentifiées, filtres,
  pagination, réponses différées, retour navigateur, états d'erreur, extourne, clavier et
  rendu à 1440, 768 et 390 px.
- `AccountingEntryReadIntegrationTest` couvre les vraies requêtes HTTP avec JWT, isolation,
  pagination, filtres combinés, montants, extourne, erreur 404 et validation des paramètres.
- Les tests backend sont exécutés sur H2 en mémoire dans une copie temporaire du projet,
  sans compilation dans le répertoire de l'application en cours ni redémarrage de service.

## Démonstration frontend — KAN-395

Depuis une facture VALIDEE sans écriture, **Generate accounting entry** appelle
`POST /api/v1/invoices/{id}/accounting-entry` sans corps. L'attente bloque les doubles
soumissions. Le statut et l'écriture viennent de la réponse ; l'activité est invalidée.
Une réponse `ACCOUNTING_ENTRY_UNBALANCED` recharge la proposition persistée pour correction.
Les prérequis de validation/doublon et les erreurs 403/404/409/réseau restent explicites.
La page réinitialise ses données quand l'identité ou l'organisation change.

Décision utilisateur : le RBAC frontend est reporté à la phase 2 (KAN-335), sans ajout
de listes de rôles dans ce parcours. Les contrôles backend et la fin de session 401
restent actifs. Référence visuelle : Figma 235:1526, état sans écriture adapté aux
composants existants. Aucun changement backend.

## Saisie partagée — KAN-396

La fiche facture et le détail Accounting réutilisent le même éditeur : ajout de ligne,
modification, TVA explicite et affectation DOSSIER/CLASSEUR/CHANTIER. Le plan et les
classifications actifs sont chargés sur toutes leurs pages. Les montants sont transmis
comme chaînes décimales ; les PATCH envoient uniquement les champs modifiés.
`If-Match` et `Idempotency-Key` protègent chaque mutation ; un rejeu après erreur réseau
conserve la clé tant que le contenu et la version restent identiques. Un conflit impose
une relecture explicite. Le brouillon reste visible sur erreur ; son annulation demande
confirmation et le rechargement du navigateur est protégé.

Les cases sélectionnent les lignes à retirer. La confirmation liste leurs identités et
explique les suppressions séquentielles, chaque appel prenant la version retournée par le
précédent. Une erreur interrompt la série et impose une relecture avant une autre tentative.
Aucun endpoint de masse n'est simulé. Une corrective non exportée reste éditable même si
sa facture est exportée ; l'originale exportée, l'extourne et la facture archivée sont protégées.
Les diagnostics désignent les seules lignes surlignées. La facture est relue après sauvegarde :
aucune transition de statut n'est calculée à partir du seul équilibre côté client.

## Vues et filtres — KAN-398

Le tableau exploite maintenant les champs KAN-386 : journal réel, nature, état d'export
propre, éligibilité et diagnostics. Une extourne n'hérite pas de l'export de sa facture.
Les vues All/Balanced/Needs attention/Ready to export/Exported utilisent ces valeurs.
`needsAttention` et `exportEligible` n'étant pas des filtres d'API, les deux vues concernées
chargent toutes les pages correspondant aux autres filtres, puis appliquent le prédicat
serveur et paginent localement. Aucun résultat partiel n'est affiché si une page échoue.
Ce choix MVP évite un changement backend ; un filtre dédié sera préférable pour de très
volumineux ensembles de données.

Période inclusive, journal (y compris inactif historique), équilibre, export, type et tri
sont conservés dans l'URL, avec retour à la première page lors d'un changement. Les filtres
sont supprimables individuellement. Le tri expose uniquement les champs pris en charge.
Columns masque les colonnes facultatives ; identité et actions restent disponibles.
Les préférences sont isolées par utilisateur et organisation. Review issue ouvre le détail
exact et ses diagnostics ; les erreurs et états vides restent explicites.

## Création manuelle — KAN-399

Create entry ouvre un panneau avec recherche paginée des factures candidates via
`GET /api/v1/accounting-entries/creation-candidates`, sélection d’un journal actif et
lignes locales ajoutables/retirables. `POST /api/v1/accounting-entries` reçoit en une fois
facture, journal, date, libellé et lignes. Les totaux affichés avant sauvegarde sont un
aperçu explicite ; les totaux et diagnostics persistés proviennent du serveur.
Une facture fournisseur validée éligible et un journal actif sont nécessaires.

L’enregistrement bloque la double soumission. Les erreurs conservent le brouillon ;
ACCOUNTING_ENTRY_ALREADY_EXISTS propose l’écriture existante uniquement à partir de
l’identifiant serveur. La fermeture d’un brouillon demande confirmation. Après succès,
la liste est invalidée et le détail de l’identifiant retourné est ouvert.

## Extourne et corrective — KAN-402

Sur une originale GENERATED liée à une facture EXPORTEE, la confirmation appelle sans
corps `POST /api/v1/accounting-entries/{id}/reversal` ou `/corrective-entry`.
Le second endpoint crée lui-même l’extourne si nécessaire et réutilise la corrective
existante : aucun enchaînement de deux créations côté frontend.
Le résultat est relu via le détail enrichi ; aucun état d’export n’est hérité de la facture.
La corrective est une copie à vérifier et modifier dans l’éditeur KAN-396, pas une correction
annoncée comme terminée dès sa création. L’originale et l’extourne restent en lecture seule.

Les liens vers les parents utilisent `reversedAccountingEntryId`. Show related entries
charge toutes les pages de recherche sur le numéro de facture et conserve seulement le
même invoiceId ; sans numéro, la lecture couvre le résultat entier. Ces liens préservent
les filtres. L’historique reste accessible dans l’onglet History de la facture liée.
Après conflit ou résultat incertain, une relecture du détail et des écritures liées est
requise avant une nouvelle tentative. Les refus restent explicites. Les dialogues
restaurent le focus et la fermeture du détail protège le brouillon de ligne actif.
