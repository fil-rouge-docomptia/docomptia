# Démonstration Accounting — lot frontend KAN-385

## Version disponible

Branche cumulative : `KAN-405_frontend_duplication_export_plan`.
Elle contient KAN-395, KAN-396, KAN-398, KAN-399, KAN-402 et la partie disponible de KAN-405.
Les changements du lot concernent uniquement frontend, tests et documentation. Aucun backend
ni dépendance supplémentaire. Le RBAC frontend est reporté en phase 2 ; les contrôles serveur
et les restrictions de gestion déjà présentes restent actifs.

## Préparer la démonstration

Utiliser un backend incluant les contrats KAN-386/387/388 et les API d’extourne/corrective
existantes. Les tests Playwright emploient des réponses contrôlées et ne préparent pas les
données d’une organisation réelle. Aucun jeu de données de test n’est embarqué dans l’application.

Prévoir une session authentifiée dans la bonne organisation, des comptes actifs et :

- une facture fournisseur VALIDEE sans écriture et sans doublon en attente pour la génération ;
- une autre facture éligible et un journal actif pour Create entry ;
- une originale sur facture EXPORTEE pour montrer l’extourne/corrective ;
- facultativement, des affectations analytiques actives pour les lignes.

Les journaux ne sont pas créés implicitement. La génération automatique dépend de la
configuration comptable existante ; toute configuration manquante reste signalée par le serveur.

## Parcours à montrer

1. Facture → Accounting → Generate accounting entry. La proposition confirmée apparaît.
   Ajouter/modifier/retirer des lignes, saisir TVA et affectation analytique, puis observer
   les totaux et diagnostics persistés. Aucun statut métier n’est déduit localement du solde.
2. Accounting → Entries : recherches, période, journal, vues Balanced/Needs attention/Ready
   to export/Exported, tri et colonnes. Review issue ouvre l’écriture et ses diagnostics.
3. Create entry : sélectionner une facture et un journal, saisir libellé/date et lignes.
   Save entry ouvre le détail retourné par le serveur. Un brouillon déséquilibré peut être
   enregistré et complété ; son éligibilité reste celle confirmée par le serveur.
4. Originale exportée → Create corrective entry → confirmation. La corrective est ouverte,
   ses lignes restent à vérifier et modifier. Show related entries et les liens parents
   permettent de retrouver l’originale et l’extourne. L’historique est dans la facture liée.
5. Chart of accounts : Duplicate account préremplit un nouveau formulaire avec numéro vide.
   Export CSV télécharge tous les résultats filtrés, dans l’ordre courant et sur toutes les
   pages. Import et gestion existante sont conservés.

## Limites suivies dans Jira

| Ticket frontend | Contrat backend encore nécessaire |
| --- | --- |
| KAN-397 : régénérer/appliquer une règle | KAN-392 |
| KAN-400 : Set journal / Mark ready en lot | KAN-389 |
| KAN-401 : export par IDs d’écritures, y compris correctives | KAN-390 |
| KAN-403 : créer/configurer/dupliquer/supprimer une règle | KAN-391 |
| KAN-404 : simulation/import de règles | KAN-393 |
| KAN-405 : Category, Description, Usage | KAN-394 |

KAN-395/396/398/399/402 sont en revue. KAN-405 reste en cours pour les métadonnées manquantes.
Les autres tickets frontend restent à faire avec leur dépendance documentée. Assignation :
Alexandre Grodent ; priorité Highest. L’export de la corrective ne fait pas partie de ce lot.

Les vues Needs attention/Ready et les écritures liées chargent les pages nécessaires avant
filtrage local sur les valeurs serveur. Prévoir des filtres backend pour de grands volumes.

## Validation du lot

- `npm run lint` et `npm run build` dans `frontend` : réussis.
- Régression ciblée Accounting/génération/saisie/corrective : 112 tests réussis.
- Régression ciblée plan/gestion/import/export : 102 tests réussis.
- Suite Playwright complète finale : **800 réussis, 4 échecs préexistants** sur 804.
  Les mêmes quatre échecs ont été reproduits sur la base `1a8f2cc` avant le lot :
  `invoice-upload.spec.ts` (statuts Inbox, filtre OCR), `invoices.spec.ts` (sections de review,
  actions d’approbation). Aucun nouvel échec dans cette exécution.
- Captures de la génération, saisie, liste, création, confirmations et plan inspectées à
  1440, 768 et 390 px ; clavier, focus, erreurs et réponses différées vérifiés par Playwright.
- Références Figma : `235:1526`, `283:973`, `312:850`, formulaire existant `317:11322`.

Voir [le parcours Accounting](frontend-accounting.md) et
[le plan comptable](frontend-chart-of-accounts.md) pour les contrats et détails de comportement.
Les fichiers personnels `docs/plan-presentation-post-mortem.md` et `docs/presentations/`
sont conservés hors des commits de ce lot.

## Push manuel

Aucun push n’a été effectué. Pour publier toute la version de démonstration :

```bash
git push -u origin KAN-405_frontend_duplication_export_plan
```

Pour publier aussi les branches intermédiaires destinées aux revues individuelles :

```bash
git push -u origin KAN-395_frontend_generation_initiale_ecriture
git push -u origin KAN-396_frontend_saisie_lignes_comptables
git push -u origin KAN-398_frontend_vues_et_filtres_accounting
git push -u origin KAN-399_frontend_creation_manuelle_ecriture
git push -u origin KAN-402_frontend_extourne_et_correction
```
