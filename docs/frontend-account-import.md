# Assistant d'import du plan comptable — KAN-290

La route protégée `/accounting/accounts/import` est accessible par Import CSV dans le
plan comptable, sur desktop et mobile. La garde ADMIN suit le backend MVP existant,
avec l'exception RBAC demandée ; aucun système de permissions supplémentaire n'est ajouté.
Le backend reste responsable de l'autorisation et de l'isolation par organisation.

## Figma et interface

Fichier Docomptia, page `11 — Accounting` (`283:972`) :

- [Upload](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-1558)
- [Map Columns](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-1916)
- [Review](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-2271)
- [Confirm Import](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-2626)

Les pages Prototype Flows et Responsive ne proposent pas de variante dédiée à ces
quatre étapes. Le contenu utilise une largeur maximale de 800 px, les espacements,
rayons et tokens existants, Inter, Lucide et les composants shadcn installés.
Sur mobile, étapes et champs se répartissent en colonnes ; les actions s'empilent.
Le tableau des valeurs mappées défile dans sa région, sans élargir la page.

## Parcours et contrat

Le service `account-import.ts` suit le [contrat KAN-356](account-import-api.md) :
trois POST multipart authentifiés `/api/v1/chart-of-accounts/import/{inspect,preview,confirm}`.
Le fichier original est envoyé avec le séparateur choisi ; `mapping` est une part JSON
avec `Content-Type: application/json`. Aucun identifiant d'organisation n'est envoyé.

1. **Upload** : choix clavier ou glisser-déposer d'un seul fichier. Extension CSV, MIME,
   fichier non vide et limite de 20 Mio vérifiés avant envoi. Le serveur vérifie ensuite
   UTF-8, syntaxe, en-têtes, nombre de lignes/colonnes et taille des cellules. Le séparateur
   virgule ou point-virgule est explicite. Aucun nombre de lignes n'est inventé localement.
2. **Map Columns** : chaque colonne détectée affiche un exemple réel et un champ cible
   ou Ignore. Numéro, libellé et type obligatoires ; active facultatif, vrai par défaut.
   Les indices partent de zéro et chaque champ ne peut être assigné qu'une fois.
   Le type est obligatoire contrairement à Figma, pour respecter le modèle de compte.
3. **Review** : nombres réels, statuts et erreurs de chaque ligne, paginés par dix.
   Le tableau complète la synthèse Figma pour rendre toutes les valeurs vérifiables.
   Comptes existants et doublons ignorés ; aucune écriture ni réactivation.
   Les lignes invalides bloquent Continue tant que leur exclusion n'est pas cochée.
   Aucun compte nouveau : état explicite et confirmation bloquée.
4. **Confirm Import** : récapitulatif du fichier et des nombres importés/ignorés/exclus.
   Import accounts envoie l'empreinte de prévisualisation et le choix d'exclusion.
   Après réponse réelle uniquement, rapport détaillé avec les nombres et lignes du serveur.
   Les [résultats KAN-291](frontend-account-import-results.md) restent consultables avant
   téléchargement ou retour explicite au plan fraîchement chargé.

## Erreurs, navigation et limites

- 400 : erreur de validation serveur ; 413 : fichier dépassant la limite d'envoi.
- 403 : accès refusé ; 404/405/501 : import indisponible. La progression est bloquée,
  l'annulation reste possible. Aucune importation simulée.
- 409 : prévisualisation périmée. Écran d'échec ; Retry import retourne au mapping pour une
  nouvelle prévisualisation obligatoire.
- Erreur réseau/serveur à la confirmation : résultat incertain, aucun rejeu automatique.
  Fichier et mapping conservés ; nouvelle prévisualisation obligatoire pour distinguer les
  comptes encore nouveaux de ceux qui auraient déjà été créés. Même règle après tout rejet
  de confirmation. Les erreurs d'inspection/prévisualisation permettent une nouvelle tentative.
- 401 : fin de session via le client existant.

Les contrôles sont désactivés pendant les requêtes et une garde empêche les doubles envois.
Un retour pour changer le mapping invalide la prévisualisation et le choix d'exclusion.
Changer le fichier ou le séparateur invalide aussi l'inspection et le mapping.
Les paramètres d'URL ne permettent ni de sauter une étape ni de lancer un import.
Cancel quitte sans requête de confirmation. Sortir du composant annule l'attente et ignore
les réponses tardives ; cela n'annule pas une transaction déjà reçue par le serveur.
Le fichier reste uniquement en mémoire et disparaît à la sortie ou au changement de session.
Les étapes annoncent leur progression et reçoivent le focus ; labels et clavier natif
des composants restent disponibles.

## Vérification

`frontend/e2e/account-import.spec.ts` vérifie les trois requêtes et leurs parts exactes,
les réponses différées, validation avant envoi, mapping unique, prévisualisation/exclusion,
absence de rejeu après erreur, pagination, annulation, session et rôles, navigation clavier
et rendu à 1440, 768 et 390 px. Les réponses API sont contrôlées dans ces tests navigateur.
Les 28 tests backend ciblés de KAN-356 vérifient séparément le vrai service, la sécurité,
l'isolation, le parsing et le rollback transactionnel. Aucun service en cours n'est redémarré.
