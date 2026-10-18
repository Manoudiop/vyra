# Tests VYRA

> État au 2026-10-18 (phase 18) : **453 tests** : API 267 (unitaires + e2e sur une vraie base PostgreSQL et MinIO), mobile 166 (écrans rendus avec Expo Router), `@vyra/shared` 20. L'admin Next.js est couvert par son typecheck, son lint, son build de production (en CI) et par les e2e de ses endpoints.

## Lancer les tests

```bash
pnpm db:up        # PostgreSQL (5440) et MinIO (9100) via docker compose
pnpm test         # shared + API + mobile (Turborepo)
```

- **API** (`apps/api`, Jest + SWC) : la configuration de test (`test/setup-env.ts`) n'utilise aucun `.env` et pointe sur la base **`vyra_test`**. `test/global-setup.ts` crée cette base si besoin et applique les migrations. Par sécurité, il refuse toute base dont le nom ne finit pas par `_test`. Les suites e2e tournent en parallèle et chacune ne nettoie que ses propres comptes. Le test S3 se saute sans MinIO, sauf avec `REQUIRE_MINIO=1` (CI).
- **Mobile** (`apps/mobile`, jest-expo + React Native Testing Library) : les écrans sont rendus avec le vrai routeur (`renderRouter`), et seuls les clients d'API sont simulés.
- **Couverture** : `pnpm --filter @vyra/api exec jest --coverage` et `pnpm --filter @vyra/mobile exec jest --coverage`. Les source maps sont injectées en ligne (`sourceMaps: 'inline'` dans la config Jest de l'API), pour que les lignes signalées soient celles du TypeScript.

Couverture mesurée : API **98 % des lignes, 82 % des branches** ; mobile **90 % des lignes, 83 % des branches**. Ce qui reste non couvert : chemins d'erreur d'infrastructure (S3 indisponible, journalisation), déclarations.

## Parcours critiques → tests

| Parcours                                                                                                                                | Backend                                                                                                                            | Mobile                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Inscription, connexion, session (refresh, rotation, réutilisation, rotations simultanées, expiration), déconnexion, mot de passe oublié | `auth.e2e-spec`, `auth-rate-limit.e2e-spec`, `throttle-per-user.e2e-spec`, `roles.guard.spec`                                      | `auth-screens.test`, `session-store.test`, `authorized-request.test`, `navigation.test` |
| Onboarding et profil                                                                                                                    | `profile.e2e-spec`                                                                                                                 | `onboarding-flow.test`, `onboarding-store.test`                                         |
| Dressing : CRUD, propriété, limite FREE, upload sécurisé, pipeline d'image                                                              | `closet.e2e-spec`, `images.e2e-spec`, `image-pipeline.spec`, `local-storage.adapter.spec`, `s3-storage.e2e-spec`                   | `closet.test`, `add-item.test`, `photo.test`                                            |
| Analyse IA d'un vêtement                                                                                                                | `ai.e2e-spec`, `clothing-classifier.spec`                                                                                          | `add-item.test`                                                                         |
| Génération de look (moteur, contraintes, météo, apprentissage, anti-répétition, explications)                                           | `candidate-engine.spec`, `stylist.e2e-spec`, `stylist-copy.spec`, `weather.e2e-spec`                                               | `stylist.test`                                                                          |
| Détail d'un look : enregistrer, porter, avis                                                                                            | `outfit-actions.e2e-spec`                                                                                                          | `stylist.test`                                                                          |
| Agenda et historique de port                                                                                                            | `calendar.e2e-spec`, `local-day.spec`                                                                                              | `calendar.test`                                                                         |
| Apprentissage du style, analyse IA du style                                                                                             | `learn-style.spec`, `style-learning.service.spec`, `style-profile.e2e-spec`, `style-analysis.spec`                                 | `style-profile.test`                                                                    |
| Météo                                                                                                                                   | `weather.spec`, `weather.e2e-spec`                                                                                                 | `weather.test`                                                                          |
| Limites d'usage (comptage, refus, parallélisme, fuseaux)                                                                                | `usage.e2e-spec`, `usage-period.spec`                                                                                              | `usage.test`                                                                            |
| Abonnements et paywall                                                                                                                  | `subscriptions.spec`, `subscriptions.e2e-spec`                                                                                     | `subscriptions.test`                                                                    |
| Analytics et vie privée                                                                                                                 | `analytics.service.spec`, `analytics.e2e-spec`                                                                                     | `analytics.test`                                                                        |
| Réglages : langue, suppression de compte                                                                                                | `admin.e2e-spec` (effacement complet : données, photos, sessions), `profile.e2e-spec`, `s3-storage.e2e-spec` (dossier utilisateur) | `settings.test`                                                                         |
| Admin : accès réservé, utilisateurs, abonnements, métriques                                                                             | `admin.e2e-spec`, `analytics.e2e-spec`                                                                                             | — (Next.js : typecheck, lint, build)                                                    |
| **Propriété des données** (aucun accès aux données d'autrui)                                                                            | dans chaque e2e concerné : closet, images, outfits, calendar, stylist, style, weather                                              | —                                                                                       |
| **Contrat API ↔ mobile**                                                                                                                | `routes-contract.e2e-spec` (routes OpenAPI → `apps/api/contract/routes.json`)                                                      | `api-contract.test` (chaque appel de chaque client vise une route existante)            |

## Contrat entre l'API et l'app

`apps/api/contract/routes.json` liste les routes publiées par l'API (document OpenAPI). Le test API échoue si ce fichier n'est plus à jour ; le test mobile échoue si l'app appelle une route absente, ou si une fonction de client n'a pas d'appel d'exemple. Après un changement de routes :

```bash
UPDATE_CONTRACT=1 pnpm --filter @vyra/api exec jest routes-contract
```

## Intégration continue

`.github/workflows/ci.yml` (push sur `main` et pull requests) : PostgreSQL et MinIO en conteneurs, `pnpm install --frozen-lockfile`, puis `format:check`, `typecheck`, `lint`, `test` et un **contrôle de dérive Prisma** (les migrations rejouées sur une base « shadow » doivent produire exactement le schéma). Les variables utiles aux tests sont déclarées dans `turbo.json` (`tasks.test.env`) : sans cela, Turborepo les filtre et les tests retombent silencieusement sur les valeurs locales.

Simulé localement sans `.env`, sur une base créée de zéro et avec MinIO obligatoire : tout passe. Le workflow lui-même n'a pas encore tourné sur GitHub (le dépôt n'a pas de remote).

## Ce que la phase 17 a corrigé

- **Faille de session** : deux rotations simultanées du même refresh token (un voleur et l'utilisateur légitime) laissaient survivre le jeton émis par la rotation gagnante. Désormais, la réservation de l'ancien jeton et l'émission du nouveau se font dans une même transaction, et la révocation de famille couvre aussi ce nouveau jeton.
- **Messages d'erreur** : inscription avec un email déjà utilisé (« Un compte existe déjà avec cet email… ») et code de réinitialisation invalide ou expiré, au lieu de messages génériques.
- **Outillage** : couverture API calculée sur le code transformé (lignes fausses), filtrage des variables d'environnement par Turborepo (la CI aurait visé la mauvaise base), test S3 qui pouvait se sauter silencieusement.
