# Résultats de l'import du plan comptable — KAN-291

Extension de l'[assistant KAN-290](frontend-account-import.md), sur la même route
`/accounting/accounts/import`. Le backend [KAN-356](account-import-api.md) est réutilisé
sans modification : seule la réponse réelle du POST multipart `confirm` crée un rapport.

## Figma et adaptations au contrat

Fichier Docomptia, page Accounting `283:972` :

- [Importing](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-13018), carte `330:2641`.
- [Success](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-13020), carte `330:2703`.
- [Partial Success](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-13022), carte `331:2690`.
- [Import Failed](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=324-13024), carte `331:2766`.

Largeur maximale 800 px, cartes avec marges internes de 24/32 px, titres 18/28 px,
rayons et couleurs info/success/warning/destructive du design system existant.
Aucune variante dédiée retrouvée dans Prototype Flows ou Responsive ; adaptation à
1440, 768 et 390 px avec actions empilées et tableau défilant dans sa propre région.

L'API est synchrone et ne fournit aucune progression par ligne : l'attente est indéterminée,
sans pourcentage ni compteur traité inventé. Le stepper indique uniquement l'étape 4 sur 4.
Pendant la confirmation, les actions de l'assistant sont masquées pour éviter un double envoi.
Quitter la page annule l'attente locale, pas une transaction déjà reçue par le serveur.

## Résultats et rapport

- **Succès** : au moins un compte créé et aucune ligne INVALID. Les lignes EXISTING et
  DUPLICATE restent visibles comme ignorées ; elles ne constituent pas un échec partiel.
- **Terminé avec erreurs** : présence de lignes INVALID, explicitement exclues avant confirmation.
  Les nombres importés/ignorés/rejetés et toutes les erreurs restent visibles dans le rapport.
  « Rejected » remplace « Failed » pour distinguer ces exclusions d'une transaction échouée.
- **Aucune création** : titre explicite si le serveur renvoie zéro compte importé.
- Le nom du fichier et la date `importedAt` sont réels. Aucun identifiant d'incident ni nom
  d'auteur n'est inventé. L'identifiant utilisateur retourné figure dans le rapport CSV.
- Le tableau réutilise les lignes de prévisualisation, paginées par dix. Le filtre All /
  Imported / Skipped / Rejected repart en page 1 ; une catégorie vide a un état explicite.
- **Download report** télécharge toutes les lignes, indépendamment du filtre et de la page.
  CSV UTF-8 avec BOM, guillemets et retours ligne échappés, valeurs pouvant être interprétées
  comme formules préfixées par une apostrophe. Numéros, statut actif, erreurs et métadonnées
  proviennent du résultat serveur. Un échec local de téléchargement permet de réessayer.
- **View accounts** ouvre le plan fraîchement chargé. Ce libellé remplace « View imported
  accounts » car l'API ne fournit pas de filtre par import. Les comptes inactifs restent inactifs.
- **Import corrected CSV / Import another CSV** efface le rapport et reprend à l'envoi d'un
  nouveau fichier, avec inspection, mapping et prévisualisation obligatoires.

Le rapport reste en mémoire pendant cette visite uniquement. L'interface demande de le
télécharger avant de partir ou de commencer un nouvel import. Navigation, rechargement,
déconnexion ou changement d'utilisateur/organisation effacent fichier, mapping et résultat.
Aucun historique persistant n'est simulé ; un tel besoin nécessiterait un endpoint backend.

## Échec et reprise

Les erreurs connues 400 `ACCOUNT_IMPORT_INVALID`, 409 `ACCOUNT_IMPORT_PREVIEW_CHANGED`,
403, 404/405/501 et 413 n'annoncent aucune création pour cette tentative rejetée. Un problème
réseau, une réponse JSON illisible ou une erreur serveur affiche **Import not confirmed** :
des comptes ont éventuellement été créés, aucun rollback n'est supposé.

**Retry import** conserve fichier et mapping, invalide l'ancienne empreinte et le choix
d'exclusion, puis retourne au mapping. Il ne renvoie jamais directement `confirm`.
Continue récupère un nouvel aperçu : les comptes déjà acceptés deviennent EXISTING selon
le backend, seuls les nouveaux restent importables après une nouvelle confirmation explicite.
Les protections transactionnelles, l'empreinte et l'unicité restent gérées par KAN-356.
403/404/405/501 bloquent la reprise ; Cancel permet de quitter. 401 ferme la session via le
client existant. La garde ADMIN MVP est conservée selon l'exception RBAC autorisée.

## Vérification

`frontend/e2e/account-import.spec.ts` couvre le parcours et les parts multipart, attente réelle,
succès/partiel/zéro création, détails rejetés au-delà de la première page, filtres, téléchargement
intégral et échappement CSV, erreurs de confirmation, reprise avec nouvelle empreinte, réponses
tardives, session et organisation, clavier, et les quatre états à 1440/768/390 px.
Les réponses API sont contrôlées dans les tests navigateur ; aucun nouveau test backend
ni redémarrage de service n'est nécessaire pour ce ticket exclusivement frontend.
