# Conventions de commits Git

Ce document définit les règles de rédaction des messages de commit pour ce projet. Elles sont basées sur la spécification [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), les guidelines de la [Commission européenne](https://ec.europa.eu/component-library/v1.15.0/eu/docs/conventions/git/) et les bonnes pratiques de la communauté.

## Format

```
<type>(<portée optionnelle>): <description>

[corps optionnel]

[pied de page optionnel]
```

Seul l'en-tête est obligatoire. Chaque ligne du message ne doit pas dépasser **100 caractères**.

---

## Types

Le type indique la nature du changement. Il doit être l'un des suivants :

| Type | Usage |
|------|-------|
| `feat` | Ajout, modification ou suppression d'une fonctionnalité |
| `fix` | Correction d'un bug |
| `refactor` | Réécriture du code sans changement de comportement |
| `perf` | Amélioration des performances |
| `style` | Formatage, espaces, ponctuation — aucun changement de logique |
| `test` | Ajout ou correction de tests |
| `docs` | Modifications de la documentation uniquement |
| `build` | Outils de build, dépendances, versions |
| `ops` | Infrastructure, déploiement, CI/CD |
| `chore` | Commit initial, modification de `.gitignore`, tâches sans impact sur le code |
| `revert` | Annulation d'un commit précédent |

---

## Portée (scope)

La portée est **optionnelle**. Elle précise le périmètre du changement entre parenthèses après le type.

```
feat(auth): add JWT refresh token support
fix(invoice): handle null amount edge case
```

Utiliser des valeurs cohérentes et propres au projet : `api`, `auth`, `invoice`, `ocr`, `storage`, `docker`, etc.  
Ne pas utiliser la portée pour référencer des tickets ou issues (réservé au pied de page).

---

## Description

La description suit immédiatement les deux-points et l'espace. Elle est **obligatoire**.

Règles :
- Utiliser l'**impératif présent** : `add`, `fix`, `remove` — pas `added`, `fixed`, `removes`
- **Pas de majuscule** en début de phrase
- **Pas de point final**
- Rester concis (une ligne)

```
feat: add PDF export for invoices
fix(api): prevent duplicate invoice submission
docs: update environment setup instructions
```

---

## Corps (body)

Le corps est **optionnel**. Il explique la **motivation** du changement et contraste avec le comportement précédent.

- Séparé de la description par une ligne vide
- Même règle de temps que la description (impératif présent)
- Peut s'étendre sur plusieurs lignes

```
refactor(ocr): replace synchronous calls with async processing

The previous implementation blocked the main thread during OCR analysis,
causing timeouts on large invoice batches. This change uses CompletableFuture
to handle requests concurrently.
```

---

## Pied de page (footer)

Le pied de page est **optionnel**. Il sert à :

- Référencer des issues : `Closes #123`, `Refs #456`
- Documenter les changements cassants (voir ci-dessous)

```
fix(storage): correct file path resolution on Windows

Closes #89
```

---

## Changements cassants (breaking changes)

Un changement cassant est signalé de **deux façons** (cumulables) :

**1. Avec `!` avant les deux-points dans l'en-tête :**
```
feat(api)!: remove deprecated /v1/upload endpoint
```

**2. Avec `BREAKING CHANGE:` dans le pied de page :**
```
feat(auth): replace session tokens with stateless JWT

BREAKING CHANGE: session-based authentication is no longer supported.
Clients must implement the OAuth2 flow described in docs/auth.md.
```

> `BREAKING CHANGE` doit être en majuscules. Un `!` peut être utilisé seul pour les changements simples ; le pied de page est préférable pour expliquer l'impact et la migration.

---

## Revert

Pour annuler un commit, utiliser le type `revert`. Le corps doit mentionner le hash du commit annulé.

```
revert: feat(invoice): add bulk export

This reverts commit a3f5c2d.
```

---

## Impact sur le versionnement sémantique

| Changement | Version |
|------------|---------|
| `BREAKING CHANGE` / `!` | Majeure (1.0.0 → 2.0.0) |
| `feat` | Mineure (1.0.0 → 1.1.0) |
| `fix`, `perf`, autres | Patch (1.0.0 → 1.0.1) |

---

## Exemples complets

```
feat(invoice): add QR code generation for electronic invoices
```

```
fix(ocr): handle corrupted PDF files without crashing

The OCR client previously threw an unhandled exception on malformed PDFs.
Added input validation and a graceful fallback returning an empty result.

Closes #42
```

```
feat(api)!: restructure invoice response payload

BREAKING CHANGE: the `invoiceDate` field is now returned as ISO 8601
string instead of Unix timestamp. Update all client-side parsers accordingly.
```

```
build(docker): upgrade PostgreSQL image to 16-alpine
```

```
docs: add git commit guidelines
```

---

## Résumé des règles essentielles

1. L'en-tête est **obligatoire**, le corps et le pied de page sont optionnels.
2. Le type doit être l'un des types listés ci-dessus.
3. La description est à l'**impératif présent**, sans majuscule initiale, sans point final.
4. Les lignes ne dépassent pas **100 caractères**.
5. Les changements cassants sont toujours signalés (avec `!` et/ou `BREAKING CHANGE:`).
6. Les références d'issues vont dans le **pied de page**, pas dans la portée.
