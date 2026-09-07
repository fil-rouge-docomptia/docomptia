# Import du plan comptable — KAN-356

L'administrateur peut importer un CSV après inspection, mapping et confirmation.
Les routes utilisent la permission existante `MANAGE_ACCOUNTING_CONFIGURATION`.
L'organisation provient exclusivement de l'utilisateur authentifié.

## Format et limites

- CSV UTF-8, BOM facultatif, extension `.csv`, maximum 20 Mio.
- Première ligne d'en-têtes non vides et distincts ; au moins trois colonnes.
- Séparateur explicite `,` (défaut) ou `;`. Fins de ligne LF, CRLF ou CR.
- Champs entre guillemets, guillemets doublés et champs multilignes acceptés.
- Lignes blanches ignorées. Maximum 10 000 lignes de données, 100 colonnes,
  8 192 caractères par cellule. Une syntaxe ou un encodage invalide bloque le fichier.
- `accountNumber`, `accountLabel`, `accountType` sont des textes obligatoires de
  255 caractères maximum après trim. Numéros alphanumériques et zéros initiaux conservés.
- Le type est libre ; aucun type métier n'est déduit ou inventé.
- `active` est facultatif : `true`/`false` (insensible à la casse), `1`/`0` ;
  une colonne absente ou une valeur vide signifie `true`.

## Endpoints

Les trois routes sont des POST sous `/api/v1/chart-of-accounts/import` et renvoient
200 avec du JSON. Elles reçoivent le même fichier dans la part multipart `file`,
et le séparateur dans `delimiter`. Aucun fichier temporaire ni job n'est persisté.

| Route | Autres données multipart | Réponse |
| --- | --- | --- |
| `/inspect` | aucune | nom, taille, séparateur, en-têtes, nombre de lignes, cinq exemples |
| `/preview` | part JSON `mapping` | empreinte, nombres par statut et toutes les lignes analysées |
| `/confirm` | `mapping`, `fingerprint`, `excludeInvalidRows` (défaut false) | nombres réels, lignes avec statut IMPORTED, auteur et date |

La part `mapping` utilise `Content-Type: application/json` et contient les indices
**à partir de zéro** :

```json
{"accountNumber":0,"accountLabel":1,"accountType":2,"active":3}
```

Les trois premiers indices sont obligatoires, distincts et dans les limites des
en-têtes. `active` peut être omis ou null et ne peut partager un autre indice.

## Prévisualisation et confirmation

Une ligne contient `lineNumber` (ligne physique du début de l'enregistrement),
`accountNumber`, `accountLabel`, `accountType`, `active`, `status` et `errors`.
Les statuts sont `NEW`, `EXISTING`, `DUPLICATE`, `INVALID`, puis `IMPORTED` après
création effective. Les champs manquants/trop longs, un booléen invalide ou un
nombre de colonnes incohérent produisent des erreurs par ligne.

La première occurrence valide d'un numéro est prise en compte ; les suivantes
sont des doublons. Un numéro déjà présent dans l'organisation est ignoré, même
si son compte est inactif. Aucun compte existant n'est modifié ou réactivé.
Les lignes invalides bloquent la confirmation tant que leur exclusion n'a pas
été explicitement choisie. Les références aux comptes existants sont préservées.

L'empreinte SHA-256 lie les octets du fichier, son nom, le mapping, l'organisation
et les statuts de prévisualisation. Le serveur recalcule l'analyse à la confirmation.
Un changement exige une nouvelle prévisualisation. Les imports d'une organisation
sont sérialisés par verrou ; la contrainte d'unicité protège aussi contre une création
concurrente hors import. Toute violation annule la transaction entière.

Un rejeu d'une confirmation ayant créé des comptes reçoit 409 car la prévisualisation
a changé. Après une nouvelle prévisualisation, ces comptes sont ignorés ; aucun doublon
n'est créé. Une erreur réseau ne prouve pas l'échec de la transaction : refaire la
prévisualisation avant de confirmer à nouveau.

Un audit `CSV_IMPORT` conserve organisation, auteur, date, empreinte et nombres pour
chaque import ayant créé des comptes. Les comptes eux-mêmes conservent leurs dates.
Le rapport détaillé est renvoyé dans la réponse, sans stockage persistant ni téléchargement
historique du rapport dans ce MVP.

## Erreurs et validation

- 400 `ACCOUNT_IMPORT_INVALID` : fichier, mapping ou exclusion invalide.
- 413 `ACCOUNT_IMPORT_INVALID` : limite propre à l'import dépassée (les limites HTTP
  globales peuvent aussi refuser le multipart avant le contrôleur).
- 409 `ACCOUNT_IMPORT_PREVIEW_CHANGED` : prévisualisation périmée ou conflit concurrent.
- 401/403 : authentification/permission existante.
- Une route absente ou un serveur indisponible ne constitue jamais un succès.

Tests : `AccountImportCsvReaderTest` et `AccountImportControllerIntegrationTest`.
Les tests d'intégration utilisent H2, le vrai service transactionnel et la chaîne de
sécurité ; un conflit injecté après une insertion vérifie le rollback complet.
Les tests sont exécutables avec `mvn -Dtest=AccountImportCsvReaderTest,AccountImportControllerIntegrationTest test`.
KAN-290 utilise ce contrat ; KAN-291 traite la présentation détaillée des résultats.
