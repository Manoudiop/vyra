# VYRA

> **Ton dressing. Ton style. Ton IA.**
> Styliste personnel IA : l'utilisateur photographie ses vêtements, VYRA les organise en dressing numérique et compose des looks personnalisés à partir de ses vraies pièces.

Plan d'implémentation et décisions : [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Statut

| Phase  | Contenu                                                                | État    |
| ------ | ---------------------------------------------------------------------- | ------- |
| 1      | Monorepo, configuration, squelettes API / mobile / admin               | ✅      |
| 2      | PostgreSQL, schéma Prisma, migrations, seed de démo                    | ✅      |
| 3      | Authentification API (JWT, refresh rotatif, reset par code, guards)    | ✅      |
| 4      | Design system, navigation 5 onglets, écrans d'auth, routes protégées   | ✅      |
| 5      | Onboarding en 8 étapes, profil et préférences de style éditables       | ✅      |
| 6      | Dressing : grille, recherche, filtres, détail, édition, suppression    | ✅      |
| 7      | Upload photo sécurisé, stockage local/S3 (MinIO), écran d'ajout        | ✅      |
| 8      | Analyse IA des vêtements (provider mock) et pré-remplissage de l'ajout | ✅      |
| 9 → 18 | Styliste IA, détail des looks, calendrier, abonnements…                | à venir |

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
pnpm db:migrate
pnpm db:seed
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
| `pnpm db:migrate` / `pnpm db:seed` | Applique les migrations (dev) / recrée les comptes de démo                  |

Lancer une seule app : `pnpm --filter @vyra/api dev`, `pnpm --filter @vyra/mobile web`, `pnpm --filter @vyra/admin dev`.

## Application mobile

- **Expo SDK 57 + Expo Router** ; routes dans `apps/mobile/app`, code dans `apps/mobile/src`.
- **Navigation** : `(auth)` (welcome, login, register, forgot-password, reset-password) et `(app)/(tabs)` (Accueil, Dressing, **Styliste** au centre, Agenda, Profil). Les deux groupes sont gardés par `Stack.Protected` selon l'état de session : un visiteur ne peut atteindre aucun onglet, un utilisateur connecté ne revoit pas les écrans d'auth.
- **Session** (`src/features/auth/session-store.ts`, Zustand) : seul le refresh token est persisté (SecureStore — Keychain / Keystore ; `localStorage` uniquement sur Expo Web de dev), l'access token reste en mémoire. Au lancement, la session est restaurée avant de masquer le splash ; si l'API est injoignable, un écran « Réessayer » est proposé au lieu de déconnecter. Le refresh est **single-flight** (un seul appel même si plusieurs requêtes expirent en même temps).
- **Client API** : `authorizedRequest()` ajoute le Bearer, rafraîchit le token s'il expire et rejoue une fois en cas de `AUTH_REQUIRED`.
- **Design system** (`src/ui`) : tokens de `@vyra/config/tokens`, typo Manrope, `Button`, `TextField`, `Card`, `Chip`, `IconButton`, `Screen` (safe areas, clavier, pull-to-refresh), `ScreenHeader`, `Skeleton`, `EmptyState`, `ErrorState`, retours haptiques (natif uniquement), icônes Lucide.
- **i18n** : français par défaut, anglais si l'appareil est en anglais (`src/i18n`, clés typées : `en.ts` doit refléter `fr.ts`).
- **Onboarding** (`app/(app)/onboarding.tsx`) : 8 étapes (accueil, prénom, vestiaire, styles, couleurs, occasions, ville, récapitulatif), obligatoire tant que le profil n'est pas complété — garde `Stack.Protected` sur `user.onboardingCompleted`. Brouillon en mémoire (Zustand) conservé en revenant en arrière, réinitialisé à la déconnexion. Les réponses partent en une seule requête à la fin. Une ville choisie dans les suggestions renseigne aussi le pays et le fuseau horaire (sinon : fuseau de l'appareil).
- **Dressing** (onglet Dressing) : grille 2 colonnes (FlashList), recherche avec délai (300 ms), filtres par catégorie avec compteurs, favoris (mise à jour optimiste avec retour arrière en cas d'erreur), pagination infinie, tirer-pour-rafraîchir, squelettes et états vides. Détail (`app/(app)/closet/[id]`) avec statistiques d'usage, édition en modal, retrait avec confirmation. Ajout d'une pièce (`app/(app)/closet/add.tsx`) : appareil photo ou galerie (cadrage 4:5), redimensionnement JPEG ≤ 1600 px sur le téléphone avant envoi, animation pendant l'envoi, formulaire avec la couleur pré-sélectionnée d'après la photo ; une photo envoyée mais non enregistrée est supprimée en quittant l'écran. Après l'envoi, l'analyse IA pré-remplit nom, catégorie, type, couleur, style et saison ; les champs à faible confiance sont signalés « À vérifier » et tout reste modifiable. Si l'analyse échoue, le formulaire reste utilisable à la main. Les suggestions et les corrections de l'utilisateur sont conservées dans `metadata` de la pièce.
- **Édition du profil** : Profil → « Préférences de style » (`app/(app)/edit-profile.tsx`), mêmes sélecteurs que l'onboarding (`src/features/profile/pickers.tsx`).
- **Formulaires** : React Hook Form + Zod, messages traduits ; l'API revalide tout avec `@vyra/shared`.
- `pnpm --filter @vyra/mobile typecheck` génère d'abord les types des routes typées (`scripts/typegen.js`) — pas besoin de lancer Metro.

## Base de données

- PostgreSQL 16 (Docker), Prisma 7 avec l'adaptateur `pg`. Schéma : [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma), migrations versionnées dans `apps/api/prisma/migrations`.
- Le client Prisma est généré dans `apps/api/src/generated/prisma` (non versionné, régénéré par `pnpm install`).
- Commandes Prisma utiles (depuis `apps/api`) : `pnpm db:migrate` (nouvelle migration en dev), `pnpm db:migrate:deploy` (prod/CI), `pnpm db:studio`.
- Les images sont référencées par **clé de stockage** (`imageKey`), jamais par URL ; l'API signe les URLs à la lecture.

### Données de démo (`pnpm db:seed`)

Idempotent : les comptes de démo sont supprimés puis recréés à chaque exécution. Refuse de tourner si `NODE_ENV=production`. Mot de passe commun : variable `SEED_DEMO_PASSWORD` de `.env` (valeur de dev dans `.env.example`).

| Compte           | Rôle  | Plan | Contenu                                                                                       |
| ---------------- | ----- | ---- | --------------------------------------------------------------------------------------------- |
| `amina@vyra.dev` | USER  | FREE | Dakar, 20 vêtements (dont boubou, wax, caftan), 6 looks, notes, historique, calendrier, usage |
| `karim@vyra.dev` | USER  | PRO  | Abidjan, 18 vêtements (dont agbada, dashiki), 6 looks, un vêtement « disliked »               |
| `admin@vyra.dev` | ADMIN | FREE | Accès à l'admin                                                                               |

Les photos de démo sont des illustrations générées (SVG → WebP 1200×1500 + miniature 400×500) écrites dans `STORAGE_LOCAL_DIR` (`apps/api/uploads`, non versionné).

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
- **Profil** (`/api/profile`) : `GET` (profil + préférences déclarées), `PUT /onboarding` (toutes les réponses, atomique, idempotent : conserve la date de première complétion), `PATCH` (n'importe quel sous-ensemble). Vocabulaire des couleurs partagé : `STYLE_COLORS` dans `@vyra/shared` (réutilisé par le dressing et le moteur de looks).
- **Dressing** (`/api/closet`) : `GET` (recherche nom/type/couleur, `category`, `favorite`, pagination par curseur), `GET /summary` (compteurs par catégorie + limite du plan), `GET /:id` (avec statistiques : looks, nombre de ports, dernier port), `POST` (les clés d'image doivent être sous `users/<id>/` ; limite FREE de 30 pièces → `LIMIT_REACHED`), `PATCH /:id`, `DELETE /:id` (archivage : les looks passés gardent la pièce). Une pièce d'un autre compte répond `404`, comme une pièce inexistante.
- **IA** (`POST /api/ai/analyze-clothing`, `{ imageKey }`, 20/min) : renvoie une analyse (nom dans la langue du profil, catégorie, type, couleur du vocabulaire + teinte mesurée, style, saison) avec une confiance par champ. Le code métier ne dépend que de la classe abstraite `AIProvider` (`analyzeClothing`, `generateOutfit`, `explainOutfit`, `analyzeStyle`) ; l'implémentation est choisie par `AI_PROVIDER`. Seul `mock` existe (décision produit) : il **analyse réellement la photo** (segmentation du vêtement sur fond uni, mesure de la silhouette — manches, jambes, ourlet, anse… — et des couleurs en espace CIELAB, détection des motifs type wax), sans réseau ni clé. La sortie de tout provider est revalidée par Zod ; une erreur devient `AI_ERROR` sans détail interne. `generateOutfit`/`explainOutfit` arrivent en phase 9, `analyzeStyle` en phase 12.
- **Upload** (`POST /api/storage/images`, multipart `file`, 30/min) : 10 Mo max ; format détecté **d'après le contenu** (JPEG, PNG, WebP, HEIF — jamais le nom ni le MIME déclaré : SVG, GIF, fichiers tronqués refusés) ; garde-fou anti « image bombe » (40 Mpx) ; rotation EXIF appliquée puis **toutes les métadonnées supprimées (GPS compris)** ; ré-encodage WebP ≤ 1600×2000 + miniature 480×600 ; couleur dominante calculée sur la zone centrale (le vêtement, pas le fond). `DELETE /api/storage/images` supprime une photo non utilisée.
- **Images** : l'API ne stocke que des clés et renvoie des URLs signées valables ~1 h (arrondies à l'heure pour que l'app puisse les mettre en cache). En dev, `GET /api/storage/files/...?exp&sig` sert les fichiers locaux après vérification HMAC.
- **Stockage** : `STORAGE_DRIVER=local` (disque, dev) ou `s3` (AWS S3, Cloudflare R2, Spaces, MinIO… via `S3_*`). En dev, MinIO tourne dans Docker (console http://localhost:9101) et le bucket est créé automatiquement. Le seed écrit les images de démo via le driver configuré (`STORAGE_DRIVER=s3 pnpm db:seed` pour MinIO). Sur un téléphone physique, `S3_ENDPOINT` doit être joignable par le téléphone (IP LAN) puisque les URLs signées pointent dessus.
- Sondes : `GET /api/health` (processus vivant) et `GET /api/health/ready` (base joignable, sinon 503).
- Format d'erreur unique : `{ "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }` — codes dans `packages/shared/src/errors.ts`. Aucune stack trace n'est renvoyée au client.
- **Authentification** (`/api/auth`) : `register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password` ; `GET /api/users/me`.
  - Access token JWT HS256 (15 min par défaut, `JWT_ACCESS_TTL`) dans `Authorization: Bearer …`.
  - Refresh token opaque (256 bits), stocké **haché** (HMAC-SHA256), **rotatif** : chaque `refresh` l'invalide. Réutiliser un ancien token révoque toute la session (détection de vol). `logout` ne ferme que la session concernée.
  - Mots de passe en argon2id (8–128 caractères, au moins une lettre et un chiffre). Login : même réponse pour un email inconnu et un mauvais mot de passe.
  - Mot de passe oublié : code à 6 chiffres envoyé par `MailProvider` (en dev : affiché dans la console de l'API), haché, 15 min, 5 essais, usage unique ; la réponse ne révèle pas si le compte existe. Un reset déconnecte tous les appareils.
  - Toutes les routes exigent un token, sauf celles marquées `@Public()`. `@Roles('ADMIN')` restreint une route ; `@CurrentUser()` fournit l'utilisateur — les contrôles d'appartenance utilisent toujours cet id, jamais un id venant du body.
  - Rate limiting renforcé : 10 req/min/IP sur register/login, 5 req/15 min/IP sur le reset. Derrière un reverse proxy, il faudra activer `trust proxy` pour limiter par IP client (à traiter au déploiement).
- Sécurité de base : `helmet`, CORS par liste blanche (`CORS_ORIGINS`), rate limiting global (`@nestjs/throttler`), validation Zod globale.

## Tests

```bash
pnpm test
```

Les tests e2e de l'API démarrent l'application complète avec le même pipeline HTTP que la production (`apps/api/src/bootstrap/configure-app.ts`). Le test d'intégration S3 tourne contre MinIO s'il est démarré (sinon il est ignoré avec un avertissement). Chaque suite ne supprime que les comptes qu'elle a créés (les suites tournent en parallèle). Ils tournent sur une base dédiée `vyra_test`, créée et migrée automatiquement (`apps/api/test/global-setup.ts`) — PostgreSQL doit être démarré (`pnpm db:up`). La suite refuse de s'exécuter sur une base dont le nom ne finit pas par `_test`.
