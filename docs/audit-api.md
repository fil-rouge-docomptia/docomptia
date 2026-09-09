# Consultation des journaux d’audit

KAN-375 expose la table d’audit existante pour KAN-312. Cette vue ne regroupe pas
les autres historiques de factures et ne garantit pas que chaque action du produit
est déjà journalisée.

## Accès

Les deux routes nécessitent une session authentifiée et la permission MVP
`VIEW_AUDIT_LOGS` (administrateur). L’organisation vient exclusivement de
l’utilisateur connecté. Il n’existe aucune route de modification ou suppression.

- `GET /api/v1/audit-logs`
- `GET /api/v1/audit-logs/{id}` : 404 si absent ou appartenant à une autre organisation.

## Liste

Paramètres optionnels : `page` (défaut 0), `size` (défaut 25, 1–100), `userId`,
`action`, `resource`, `from` et `to` (dates ISO, bornes inclusives, heure enregistrée
par le serveur). Une période inversée ou un filtre invalide renvoie 400. Le tri
est décroissant par `createdAt` puis `auditLogId`.

Actions : `ROLE_CHANGED`, `STATUS_CHANGED`, `UPDATED`, `CSV_IMPORT`,
`FIELD_CORRECTION`, `LINE_CORRECTION`, `ASSIGNEE_CHANGED`,
`ACCOUNTING_ENTRY_REVERSED`, `CSV_EXPORT`, `FEC_EXPORT`, `OTHER`.

Ressources : `User`, `Organization`, `Invoice`, `AccountingEntryLine`,
`ChartOfAccount`, `AccountingCsvExport`, `AccountingFecExport`, `OTHER`.

Les codes `OTHER` regroupent les valeurs non reconnues sans exposer la chaîne
stockée. Un événement d’export ne prouve pas à lui seul que l’export a réussi.

La réponse contient `content`, `number`, `size`, `totalElements`, `totalPages`.
Liste et détail partagent ce format d’événement :

```json
{
  "id": 12,
  "organizationId": 1,
  "occurredAt": "2026-09-09T10:00:00",
  "actor": { "id": 1, "name": "Admin Demo" },
  "action": "ROLE_CHANGED",
  "resource": "User",
  "resourceId": 2,
  "change": { "field": "role", "previousValue": "ADMIN", "newValue": "OPERATEUR_COMPTABLE" }
}
```

## Données limitées

Les champs bruts `oldValue` et `newValue` ne sont jamais renvoyés. `change` vaut
`null` sauf pour un changement de rôle/statut utilisateur dont les deux valeurs
appartiennent strictement aux rôles MVP ou aux booléens attendus. Aucun contenu
de facture, secret, token, hash, motif ou texte d’audit arbitraire n’est exposé.

Un auteur absent ou rattaché à une autre organisation vaut `null` (ne pas le
présenter automatiquement comme « System »). Une ressource inconnue ne renvoie
pas son identifiant. Une date manquante reste `null`. Les noms d’auteur reflètent
le profil courant, car l’audit existant ne conserve pas de copie historique du nom.

Les fonctionnalités de sécurité du compte (mot de passe, 2FA, sessions serveur)
ne font pas partie de cette API ; leur contrat est suivi dans KAN-376.
