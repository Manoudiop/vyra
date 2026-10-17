# VYRA

> **Ton dressing. Ton style. Ton IA.**
> Styliste personnel IA : l'utilisateur photographie ses vêtements, VYRA les organise en dressing numérique et compose des looks personnalisés à partir de ses vraies pièces.

Plan d'implémentation et décisions : [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Statut

| Phase  | Contenu                                                  | État    |
| ------ | -------------------------------------------------------- | ------- |
| 1      | Monorepo, configuration, squelettes API / mobile / admin | ✅      |
| 2 → 18 | Base de données, auth, design system, features…          | à venir |

## Structure

```
apps/
  api/       NestJS 11 + Zod (nestjs-zod) — API REST /api, Swagger /api/docs
  mobile/    Expo SDK 57 + Expo Router — application principale
  admin/     Next.js 16 — outil interne (dev / ops)
packages/
  config/    tsconfig, ESLint partagés + design tokens (@vyra/config/tokens)
  shared/    Schémas Zod, enums, plans & limites, codes d'erreur (@vyra/shared)
  types/     Contrats TypeScript type-only (@vyra/types)
docs/        Plan, décisions
```

`@vyra/shared` et `@vyra/config` sont compilés par `tsup` (CJS + ESM) pour l'API et l'admin ; le mobile consomme directement leurs sources TypeScript via la condition d'export `react-native`.

## Prérequis

- Node.js ≥ 24, pnpm 11 (`corepack enable` ou `npm i -g pnpm`)
- Docker (PostgreSQL et MinIO)
- Pour le mobile : Expo Go (SDK 57) ou un émulateur Android. Sous Windows il n'y a pas de simulateur iOS : utiliser un iPhone physique ou `pnpm --filter @vyra/mobile web`.

## Installation

```bash
pnpm install
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
pnpm db:up
```

## Ports (choisis pour ne pas entrer en conflit avec d'autres projets locaux)

| Service             | Port                                                    |
| ------------------- | ------------------------------------------------------- |
| API                 | 4100 (`http://localhost:4100/api`, Swagger `/api/docs`) |
| Admin               | 4101                                                    |
| Expo (Metro / web)  | 8190                                                    |
| PostgreSQL          | 5440                                                    |
| MinIO API / console | 9100 / 9101                                             |

## Scripts

| Commande                           | Effet                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                         | API + Metro (mobile) en parallèle                                           |
| `pnpm dev:all`                     | Tout, admin compris                                                         |
| `pnpm build`                       | Build de tous les packages                                                  |
| `pnpm test`                        | Tests (Vitest pour shared, Jest + SWC pour l'API, jest-expo pour le mobile) |
| `pnpm lint` / `pnpm typecheck`     | ESLint / TypeScript strict sur tout le monorepo                             |
| `pnpm db:up` / `pnpm db:down`      | Démarre / arrête PostgreSQL et MinIO                                        |
| `pnpm db:migrate` / `pnpm db:seed` | Migrations / données de démo (Phase 2)                                      |

Lancer une seule app : `pnpm --filter @vyra/api dev`, `pnpm --filter @vyra/mobile web`, `pnpm --filter @vyra/admin dev`.

## Variables d'environnement

- **`.env` (racine)** : lu par l'API. Toutes les valeurs de `.env.example` sont des valeurs de **développement local**. L'API valide sa configuration au démarrage (`apps/api/src/config/env.schema.ts`) et refuse de démarrer si elle est invalide — en production elle rejette aussi les secrets `dev-only-*`, le stockage `local` et un CORS `*`.
- **`apps/mobile/.env`** : uniquement `EXPO_PUBLIC_API_URL`. Tout `EXPO_PUBLIC_*` est embarqué dans l'app : **aucun secret ici**. Sur un téléphone physique, remplacer `localhost` par l'IP LAN de l'ordinateur.
- **`apps/admin/.env.local`** : `VYRA_API_URL` (appelée côté serveur Next.js uniquement).

## Intégrations externes

Toutes passent par une interface avec une implémentation mock sélectionnée par variable d'environnement, pour que l'app fonctionne entièrement sans clé :

| Variable                                                  | Valeurs              | Note                                                      |
| --------------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `AI_PROVIDER`                                             | `mock`               | Aucun fournisseur IA réel dans le MVP (décision produit). |
| `WEATHER_PROVIDER`                                        | `mock`, `open-meteo` | Open-Meteo ne demande pas de clé.                         |
| `STORAGE_DRIVER`                                          | `local`, `s3`        | `s3` = tout service compatible S3 (MinIO en dev).         |
| `BILLING_PROVIDER`, `ANALYTICS_PROVIDER`, `MAIL_PROVIDER` | `mock`               |                                                           |

## API

- Préfixe `/api`, documentation Swagger sur `/api/docs` (désactivée en production).
- Format d'erreur unique : `{ "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }` — codes dans `packages/shared/src/errors.ts`. Aucune stack trace n'est renvoyée au client.
- Sécurité de base : `helmet`, CORS par liste blanche (`CORS_ORIGINS`), rate limiting global (`@nestjs/throttler`), validation Zod globale.

## Tests

```bash
pnpm test
```

Les tests e2e de l'API démarrent l'application complète avec le même pipeline HTTP que la production (`apps/api/src/bootstrap/configure-app.ts`).
