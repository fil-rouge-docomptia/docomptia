# Contrôles et choix du format avant export — KAN-293

Le parcours `/exports/new` prolonge la sélection KAN-292 par Validation, Format et
Confirmation. Le complément backend KAN-358 fournit les formats disponibles et le
contrôle préalable sans effet de bord, documentés dans [backend.md](backend.md).

## Références Figma

Fichier Docomptia, page Prototype Flows :

- [Validation, 631:38069](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=631-38069), carte `631:38073`.
- [Format CSV, 634:38568](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=634-38568), carte `634:38572`.
- [Format FEC, 631:38085](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=631-38085), carte `631:38089`.
- [Confirmation, 631:38114](https://www.figma.com/design/OIiZeI890EVI23MZpDpJnB/Docomptia?node-id=631-38114), carte `631:38118`.

Largeur maximale 800 px, cartes avec marges internes de 24 px et rayon de 8 px,
titres de 16 px, blocs de contrôle centrés de 560 px et couleurs du design system.
Adaptation à 1440, 768 et 390 px, radios accessibles au clavier, focus sur les titres
d'étape et sur les erreurs, totaux et listes repliables adaptés aux petits écrans.

Les comptes inactifs sont bloquants selon le validateur existant, même si Figma
les représente comme un avertissement. Aucun nombre de contrôles, journal,
montant ni modèle Sage 100 fictif n'est repris. CSV utilise les colonnes fixes du
générateur actuel ; les totaux restent séparés par devise.

## Comportement

- Le POST existant `selection/confirm` valide les identifiants explicitement choisis.
  Seul son succès ouvre Validation : éligibilité, écritures/comptes/équilibre et TVA.
  Ses erreurs détaillées restent visibles dans la sélection après actualisation.
- GET `formats` alimente le choix ; aucun format n'est proposé avant sa réponse.
  Les codes inconnus ne sont pas proposés et une liste vide bloque la suite.
- Continue à l'étape Format appelle POST `preflight` avec la même période et les
  mêmes identifiants, plus le format choisi. Aucun identifiant d'organisation
  provenant de l'URL n'est envoyé. Les règles propres au FEC restent côté serveur.
- Confirmation reprend les factures et totaux de cette nouvelle réponse, même
  si les montants ont changé depuis la sélection. Une réponse portant sur un autre
  format, une autre organisation ou d'autres identifiants n'est pas affichée.
- Retourner au format invalide la confirmation ; Continuer relance les contrôles.
  Modifier la sélection efface le résultat et recharge les candidats.
- Les doubles envois sont bloqués pendant les contrôles. Les réponses tardives
  sont ignorées après navigation ou changement d'utilisateur, organisation ou période.
- 409 affiche les factures concernées et chaque code/message de contrôle avec
  un lien vers la facture. `SELECTION_CHANGED` impose une nouvelle sélection et
  ne révèle aucun identifiant indisponible. Les erreurs restent visibles au retour arrière.
- 400/403/404/405/501 bloquent la confirmation ; réseau et 500 permettent de
  réessayer. 401 ferme la session via le client existant. Aucun nouveau RBAC.

Le parcours reste en mémoire. Rechargement ou sortie de page effacent la préparation ;
les paramètres d'URL ne permettent pas de sauter les contrôles. **Generate export**
lance ensuite la génération KAN-294, qui revalide ces identifiants et le format
avant de stocker le fichier. Voir [frontend-export-generation.md](frontend-export-generation.md).
Les anciens endpoints CSV/FEC basés uniquement sur une période ne sont pas appelés par ce parcours.

## Fichiers et vérification

`CreateExportPage.tsx` délègue les nouvelles étapes à `ExportReview.tsx` avec
`ExportStepper.tsx` et `ExportValidationErrors.tsx`. Les types et appels API sont
dans `types/export.ts` et `services/exports.ts` ; le décodage du rapport est dans
`components/export/export-utils.ts`.

`e2e/exports.spec.ts` préserve les scénarios de sélection et d'historique.
`e2e/export-review.spec.ts` couvre les trois étapes, attentes, payloads, erreurs,
capacités, absence de génération, retours, session, clavier et rendus responsives.
Les réponses API sont contrôlées dans les tests navigateur ; les tests backend
exercent les endpoints et le validateur réels sans utiliser le service local.
