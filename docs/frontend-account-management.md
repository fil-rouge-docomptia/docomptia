# Gestion des comptes — KAN-289

La page `/accounting/accounts` permet à l'administrateur de créer et modifier un compte,
ou de le désactiver après confirmation. Les autres rôles MVP conservent la consultation.
Le backend reste responsable de l'autorisation et de l'isolation par organisation.

## Figma et composants

- [Chart of Accounts](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=312-850)
  et menu d'actions `317:1103`, page `11 — Accounting`.
- [Add Account Sheet](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=317-11322) :
  panneau `318:1360` (408 px), formulaire `319:1384`, footer `319:1390`.
- Les pages Prototype Flows et Responsive ne proposent pas de variante dédiée de gestion
  d'un compte. La modification reprend le formulaire ; la confirmation utilise le Dialog
  existant. Sur mobile, le panneau occupe la largeur disponible et reste défilable.
- Sheet, Dialog, Input, Label, Button, Badge, Tooltip et les tokens existants sont réutilisés.
  Dropdown Menu a été ajouté via la CLI shadcn pour le menu Figma, avec la primitive Radix
  correspondante et son clavier natif. Le fichier généré est placé dans `src/components/ui`
  selon l'alias `@/*` déclaré par le projet.

## Contrat réel

| Action | Requête | Réponse |
| --- | --- | --- |
| Création | `POST /api/v1/chart-of-accounts` | 201, compte créé |
| Modification | `PATCH /api/v1/chart-of-accounts/{id}` | 200, compte modifié |
| Désactivation | `POST /api/v1/chart-of-accounts/{id}/deactivate` sans body | 200, compte inactif |

La création envoie uniquement `accountNumber`, `accountLabel`, `accountType`.
Ces trois textes sont obligatoires ; les espaces extérieurs sont retirés comme côté serveur.
Le numéro reste une chaîne, sans conversion numérique ni perte de zéros initiaux.
Une modification envoie uniquement les champs changés ; un formulaire inchangé ou contenant
un champ vide ne peut pas être soumis.

Le type est libre dans le contrat actuel. Le champ permet de saisir un type ou d'utiliser
les suggestions provenant des comptes de l'organisation. Aucun catalogue ni traduction
Supplier/Expense vers PASSIF/CHARGE n'est inventé.
La description Figma est omise, faute de champ persistant. Un compte est toujours créé actif.
Le statut est informatif : aucune réactivation ou duplication n'est ajoutée.

Les routes réutilisent le client authentifié. L'organisation n'est jamais fournie dans
le payload. Le contrôle ADMIN suit `MANAGE_ACCOUNTING_CONFIGURATION`, avec l'exception
RBAC explicitement demandée pour ce MVP ; aucun nouveau mécanisme de permissions n'est créé.

## Confirmation, erreurs et navigation

La liste et le message de succès ne changent qu'après la réponse du serveur. Le compte de
la réponse remplace celui de même identifiant dans le plan chargé. Après création, la vue
recherche le numéro créé pour rendre le résultat visible ; après modification/désactivation,
les filtres courants restent appliqués. Un compte peut donc sortir du filtre Active.

La désactivation commence par un dialogue indiquant le numéro et le libellé exacts et la
conservation des références. Le focus initial est sur Cancel. Aucun appel n'est envoyé avant
confirmation ; aucune requête DELETE n'existe dans ce parcours. Le backend met uniquement
le compte inactif et conserve ses références aux écritures et règles. Un compte déjà inactif
reste modifiable, avec la désactivation désactivée dans le menu.

- 409 : erreur explicite sur le numéro déjà utilisé, focus sur ce champ, saisie conservée.
- 400 : erreur de validation ou d'état, saisie et compte courant conservés.
- 403/404 : accès ou compte indisponible, soumission bloquée dans la fenêtre ; fermeture
  et rechargement permettent de récupérer le contexte serveur courant.
- Erreur réseau/serveur : aucun succès supposé, saisie conservée pour une nouvelle tentative.
- 401 : fin de session via le client existant.

Pendant une écriture, le formulaire et l'annulation sont bloqués ; les ouvertures/fermetures
concurrentes ne produisent pas de deuxième requête. Les requêtes sont annulées à la sortie
du composant et les fenêtres invalidées au changement d'identité, d'organisation ou de rôle.
Fermer sans enregistrer abandonne seulement la saisie locale. Le focus revient au bouton
d'origine, ou au bouton Add account si la ligne a quitté le filtre.

## Vérification et suites

`frontend/e2e/account-management.spec.ts` couvre les payloads, méthodes et autorisation,
confirmation différée, numéro en conflit et nouvelle tentative, modification partielle,
désactivation et conservation de la ligne, erreurs, session expirée, rôles de consultation,
clavier, annulation et rendus à 1440, 768 et 390 px. Les tests KAN-288 continuent de vérifier
recherche, tri, pagination et isolation de session.

Les tests frontend contrôlent les réponses API ; la conservation des références côté serveur
est aussi vérifiée par lecture de `ChartOfAccountServiceImpl` et des tests backend existants.
Aucun backend, contrat, schéma ou service en cours n'est modifié.
L'import reste traité par KAN-290/KAN-291 ; l'export du plan reste hors périmètre.
