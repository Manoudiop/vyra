# VYRA — Plan d'implémentation MVP

> "Ton dressing. Ton style. Ton IA."
> Statut : Phases 1–16 terminées (2026-10-18). Prochaine : Phase 17 (tests : couverture des parcours critiques backend et mobile).
>
> Écarts vs plan, décidés en cours de route :
>
> - **Ports** : les ports par défaut (3000, 3001, 5433, 8081) sont occupés par Fittrack sur cette machine ; VYRA utilise API 4100, admin 4101, Expo 8190, PostgreSQL 5440, MinIO 9100/9101.
> - **Prisma 7** (générateur `prisma-client`, adaptateur `@prisma/adapter-pg`, `prisma.config.ts`), client généré dans `apps/api/src/generated/prisma` (non versionné, régénéré au `postinstall`).
> - **Images** : la base stocke des **clés** de stockage (`ClothingItem.imageKey` / `thumbnailKey`, `User.avatarKey`) et non des URLs ; l'API expose `imageUrl` / `avatarUrl` signées à la lecture (Phase 7), car une URL signée expire.
> - **Seed** : pas de photos tierces téléchargées ; le seed génère des illustrations « flat-lay » (SVG → WebP via `sharp`, aux tailles du pipeline d'upload). Les vraies photos arrivent avec l'upload utilisateur.
> - **Phase 3 = API uniquement** : les écrans login/register/forgot et la protection des routes côté mobile sont faits en Phase 4, avec la navigation. Reset de mot de passe par **code à 6 chiffres** saisi dans l'app (pas de lien profond). Ajout de `GET /api/users/me`.
> - **Phase 4** : styles en `StyleSheet` + tokens typés (pas de NativeWind, comme prévu). Les onglets Dressing, Agenda et Styliste sont des écrans d'attente soignés en attendant leurs phases ; les lignes du Profil (préférences, abonnement…) sont visibles mais inactives. `Tabs` est importé depuis `expo-router/js-tabs` (l'import racine est déprécié en SDK 57).
> - **Phase 5** : l'onboarding est un seul écran à étapes animées (pas 8 routes) ; brouillon en mémoire uniquement (pas de persistance disque : il se refait en une minute). Le « genre » est un choix de vestiaire (Femme / Homme / Les deux), pas une identité. Limites : 1–4 styles, 1–6 couleurs, 1–5 occasions (« Surprends-moi » exclu des préférences).
> - **Phase 6** : la lecture du stockage (URLs signées + adaptateur local) a été avancée depuis la phase 7, sinon la grille n'aurait rien à afficher ; l'upload, la suppression d'objets et l'adaptateur S3 restent en phase 7. La limite FREE de 30 pièces est déjà appliquée à la création. Les couleurs du seed ont été ramenées au vocabulaire partagé (`STYLE_COLORS`), désormais imposé par l'API.
> - **Phase 7** : détection du format par libvips/`sharp` (en-têtes binaires + décodage complet) plutôt que `file-type` (paquet ESM-only, incompatible avec la build CJS de l'API) ; le HEIC iPhone est converti en JPEG sur le téléphone avant l'envoi. URLs signées alignées sur des fenêtres d'une heure (identiques pendant l'heure → cache image côté app). Le vocabulaire de couleurs n'a pas de « bordeaux » : une pièce bordeaux est suggérée « marron » ; à revoir avec l'analyse IA (phase 8).
> - **Phase 8** : le mock IA est une vraie analyse d'image heuristique (pas des réponses figées), validée sur les 17 types de pièces du seed. Palette étendue à 20 couleurs (ajout bordeaux, orange, violet, argent) ; correspondance des couleurs en CIELAB (la distance RVB confondait sable/rose et denim/violet). Limite connue : comme tout modèle de silhouette, il suppose une pièce centrée sur fond uni (c'est ce que l'écran d'ajout conseille) ; un blazer et une chemise ont la même silhouette. Le comptage d'usage (`CLOTHING_ANALYSIS`) arrive avec la phase 14.
> - **Phase 9** : la saison n'entre pas encore dans le score (elle n'a pas de sens sans la météo pour des villes tropicales comme Dakar ou Abidjan) : elle arrivera avec la météo en phase 13. Le mock choisit le meilleur candidat du moteur ; un vrai modèle pourra arbitrer parmi les 5. Un look rejeté pénalise aussi ses pièces principales, et « un autre look » écarte les pièces principales déjà vues (corrigé après vérification sur les données d'Amina).
> - **Phase 10** : « porter aujourd'hui » suit le jour **local** de l'utilisateur (`Profile.timezone`), un seul port par jour et par look, annulable le jour même. La raison facultative de « Pas pour moi » (4 choix fermés) est stockée dans `OutfitFeedback.comment` ; elle servira à l'apprentissage du style (phase 12). Ajout d'un écran « Looks enregistrés » (accessible depuis le Profil), sans quoi « enregistrer » n'aurait pas de destination. Le look généré est relu hors de la transaction de création (Prisma chargeait les relations en parallèle sur le client de transaction, ce que `pg` dépréciera).
> - **Phase 11** : jours de calendrier = chaînes `YYYY-MM-DD` dans le fuseau de l'utilisateur (`Profile.timezone`), calculs en minuit UTC (sans heure d'été) dans `@vyra/shared`, bornes d'instants via `startOfLocalDay` (testé aux changements d'heure). Gating FREE appliqué dès maintenant (semaine en cours pour l'agenda, 7 jours glissants pour l'historique) via `PlansService`, avec `402 LIMIT_REACHED` qui servira de déclencheur au paywall (phase 15). On ne planifie pas dans le passé (l'historique sert à cela) mais on peut y retirer un look. Les « bottom sheets » sont des routes en `presentation: 'modal'` (feuille native glissable sur iOS, comme l'ajout de pièce), pas de bibliothèque de sheet. Anti-répétition : vérification en conditions réelles, la même base chemise oxford + chino revenait à 3 jours d'intervalle (pénalité par pièce trop faible), d'où l'ajout d'une pénalité par base (`usedBases`).
> - **Phase 12** : le recalcul différé utilise un simple planificateur en mémoire (debounce + sérialisation par utilisateur, `ensureFresh` avant lecture) plutôt qu'`EventEmitter2` : même découplage, sans dépendance, et une file pourra le remplacer sans toucher aux appelants (une seule instance d'API dans le MVP). Ce qui est appris vit dans `metadata.learned` ; `preferredColors/Styles/Occasions` restent les choix déclarés et `dislikedItems` les rejets explicites (fusionnés avec les rejets appris côté moteur et écran). Les styles sont appris au niveau du look (`Outfit.style`) : vérification sur les données d'Amina et Karim, où les derbies présentes dans tous les looks faisaient sortir « formel » en tête. Les poids d'affinité sont calibrés sur la moyenne par pièce du moteur (une pièce très aimée déplace son look d'environ 0,04). Comptage d'usage de l'analyse : phase 14.
> - **Phase 13** : Open-Meteo plutôt qu'OpenWeatherMap (aucune clé, donc aucun secret ni identifiant inventé) ; la forme réelle de ses réponses a été vérifiée contre l'API publique. Le mock reflète des climats d'automne par ville (pas de saisonnalité annuelle : c'est un outil de dev/démo). La saison des pièces entre enfin dans le score, via la météo plutôt que via le calendrier (sans intérêt à Dakar ou Abidjan). La ville vient du profil (onboarding), il n'y a pas de géolocalisation. L'accueil affiche aussi le look prévu du jour, et son état vide ne parle plus de « premier look » (il s'affichait pour tout le monde). Timeout Jest de l'API porté à 30 s : les e2e (inscription argon2 + générations) dépassaient parfois 5 s quand API et mobile sont testés en parallèle.
> - **Phase 14** : comptage explicite (`usage.meter(userId, metric, work)`) plutôt qu'un `UsageGuard` + `@Metered` : réservation et restitution au même endroit, lisibles et testées (y compris en parallèle). Les fenêtres suivent le fuseau du profil, et non UTC : les helpers UTC `getPeriodStart/End` du paquet partagé ont été supprimés (une seule source). L'analyse de style (PREMIUM) n'est pas comptée (limitée par le throttling). Les boutons d'offre (« Passer à Pro ») arrivent avec le paywall en phase 15 ; d'ici là, la carte se contente d'indiquer l'offre suivante et sa limite.
> - **Phase 15** : MVP en `BillingProvider` mock uniquement (cf. §6 point 1 : IAP Apple/Google vs Mobile Money reste une décision business) ; le mock est refusé en production pour qu'il ne puisse jamais offrir une offre payante. Passer de Pro à Premium (ou l'inverse) démarre un nouveau mois immédiatement, sans prorata (mock). Renouvellement et expiration sont appliqués à la lecture de l'abonnement, sans tâche planifiée ; la règle `effectivePlan` garde l'offre active jusqu'à la fin du mois payé. Le paywall n'annonce que les fonctionnalités livrées : « event styling » et « shopping » restent dans les définitions PREMIUM mais ne sont pas vendus tant qu'ils n'existent pas. Le throttler est passé **par utilisateur** pour les requêtes authentifiées (jeton vérifié), par IP sinon : constaté en e2e (requêtes partagées sur une même IP), c'est surtout la réalité du CGNAT des opérateurs mobiles. Défauts trouvés par les tests : présélection du paywall figée avant chargement de l'abonnement, et écran de bienvenue affichant l'offre suivante après l'achat.
> - **Phase 16** : événements enregistrés **côté serveur**, là où l'action a réellement lieu (fiables, impossibles à falsifier) ; le client ne rapporte que `paywall_viewed`. Le consentement retenu est un **opt-out** : statistiques produit internes, pseudonymes, sans donnée personnelle, désactivables en un geste. Le modèle (opt-in ou opt-out) doit être validé juridiquement (lois sénégalaise et ivoirienne de protection des données, RGPD pour les utilisateurs européens) avant la mise en production. `AnalyticsEvent.userId` passe en `ON DELETE CASCADE` (avant : `SET NULL`) et une migration purge les événements orphelins : vérifiée en conditions réelles, l'ancienne règle gardait les événements des comptes supprimés et gonflait les métriques (264 générations au lieu de 12). Les événements du seed sont reconstruits à partir des données de démo et validés par le catalogue (ils ne le respectaient pas). Les métriques « utilisateurs » viennent des tables sources (complètes) ; les comptes d'événements ne couvrent que les utilisateurs qui n'ont pas désactivé les statistiques.
> - `OutfitItem → ClothingItem` est en `ON DELETE CASCADE` : Postgres refusait la suppression en cascade d'un utilisateur avec `RESTRICT`/`NO ACTION`. Sans risque pour l'historique, car l'app n'efface jamais un vêtement en dur (archivage via `archivedAt`).

## 0. État du repository

| Constat                                                                                                                                                     | Conséquence                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `C:\Users\admin\Vyra` est **vide** et n'est **pas un dépôt git**                                                                                            | Création from scratch, `git init` en Phase 1. Rien à préserver.                                                                                |
| Node 24.15, pnpm 11.1, Docker 29.6 (daemon actif), pas de `psql` local                                                                                      | PostgreSQL + MinIO tournent dans `docker compose`.                                                                                             |
| Projet voisin `Fittrack` sur la même stack (Expo SDK 57, RN 0.86, React 19.2, TanStack Query 5, Zustand 5, Reanimated 4.5, Prisma 6, `nodeLinker: hoisted`) | On aligne les versions sur ce qui fonctionne déjà sur cette machine. On reprend `nodeLinker: hoisted` (indispensable pour Expo + pnpm).        |
| Windows : pas de simulateur iOS                                                                                                                             | Tests mobiles via Expo Go / dev build sur iPhone physique, émulateur Android, et Expo Web pour les smoke tests automatisés dans le navigateur. |

## 1. Structure cible

```
vyra/
├─ apps/
│  ├─ mobile/            Expo + Expo Router (app principale)
│  ├─ api/               NestJS + Prisma
│  └─ admin/             Next.js minimal (admin/dev uniquement)
├─ packages/
│  ├─ shared/            Schémas Zod, enums, constantes (catégories, plans, limites, codes d'erreur)
│  ├─ types/             Types DTO/réponses API inférés des schémas Zod
│  └─ config/            tsconfig base, ESLint flat config, Prettier, design tokens
├─ docs/                 Architecture, ADRs, ce plan
├─ docker-compose.yml    postgres:16, minio (S3 dev)
├─ turbo.json            Orchestration des scripts
├─ pnpm-workspace.yaml
├─ .env.example
└─ README.md
```

Scripts racine (Turborepo) : `pnpm dev`, `build`, `test`, `lint`, `typecheck`, `db:migrate`, `db:seed`, plus `db:up` (docker compose).

## 2. Choix techniques clés

### Partagé

- **Zod comme source de vérité** dans `packages/shared` : le mobile l'utilise avec React Hook Form, l'API avec `nestjs-zod` (validation + génération Swagger). Un seul schéma par contrat, aucune dérive client/serveur.
- TypeScript `strict` + `noUncheckedIndexedAccess` partout.

### API (NestJS 11)

- Modules : `auth`, `users`, `profiles`, `closet`, `outfits`, `calendar`, `ai`, `weather`, `subscriptions`, `usage`, `storage`, `analytics`, `admin`, `prisma`, `config`.
- **Auth** : argon2id pour les mots de passe ; access token JWT 15 min ; refresh token opaque, **haché en base, rotation à chaque refresh, détection de réutilisation** (révoque toute la famille). Forgot password : code à 6 chiffres envoyé par un `MailProvider` (mock en dev = log console), haché, expirant à 15 min, usage unique.
- **Sécurité** : `helmet`, CORS par liste blanche, `@nestjs/throttler` (plus strict sur `/auth/*` et `/ai/*`), validation d'env Zod au boot (l'API refuse de démarrer si mal configurée), filtre d'exceptions global → format unique `{ error: { code, message, details? } }`, jamais de stack trace en production.
- **Ownership** : chaque requête Prisma métier filtre par `userId` issu du JWT (jamais du body). Les accès à une ressource d'autrui renvoient `NOT_FOUND` (pas de fuite d'existence). Tests dédiés.
- **Upload** : multipart vers l'API → vérification MIME par **magic bytes** (`file-type`, pas l'extension), JPEG/PNG/WebP/HEIC, max 10 Mo → normalisation `sharp` (rotation EXIF, suppression métadonnées GPS, resize 1600 px, WebP) + miniature 400 px → `StorageService`.
- Swagger sur `/api/docs`, tous les endpoints documentés avec les codes d'erreur.

### Abstractions d'intégrations (Règle 5)

Chaque intégration = une interface + une implémentation réelle + un mock, sélectionnées par variable d'env via un provider Nest :

| Interface                                                                           | Réel (proposé)                                                                                                                        | Dev / fallback                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AIProvider` (`analyzeClothing`, `generateOutfit`, `explainOutfit`, `analyzeStyle`) | **Aucun dans le MVP (décision 2026-10-17)** — l'interface et la sélection par `AI_PROVIDER` sont prêtes pour en brancher un plus tard | `MockAIProvider` : analyse couleur dominante via `sharp` + heuristiques, génération via le moteur de règles |
| `WeatherService.getCurrentWeather(city)`                                            | Open-Meteo (gratuit, sans clé) ou OpenWeatherMap                                                                                      | `MockWeatherProvider` déterministe par ville/date                                                           |
| `StorageService` (`upload`, `delete`, `getSignedUrl`)                               | S3 compatible (`@aws-sdk/client-s3`) — MinIO en dev, R2/S3/Spaces en prod                                                             | `LocalStorageAdapter` (disque + route signée HMAC)                                                          |
| `BillingProvider` (`createCheckout`, `getSubscription`, `cancelSubscription`)       | À décider (voir §5)                                                                                                                   | `MockBillingProvider` (checkout simulé, activation immédiate)                                               |
| `AnalyticsService`                                                                  | PostHog / Segment plus tard                                                                                                           | `MockAnalyticsProvider` (logs structurés + table `AnalyticsEvent` optionnelle)                              |
| `MailProvider`                                                                      | Resend / SES plus tard                                                                                                                | Log console                                                                                                 |

Aucune clé IA, météo, storage ou billing ne transite par le mobile (Règle 6). Le mobile ne connaît que `EXPO_PUBLIC_API_URL`.

### Moteur de recommandation (le cœur produit, pas un CRUD)

Génération en **deux étages**, ce qui rend le résultat fiable même avec un LLM :

1. **Pré-sélection déterministe** (`OutfitCandidateService`, testable unitairement) :
   - filtre : vêtements disponibles, contraintes ("avoid black", "avoid jeans", "use this item"), saison/météo (température, pluie → outerwear/chaussures adaptées), `dislikedItems` ;
   - scoring : adéquation occasion/style, préférences couleurs/styles, **pénalité de récence** (porté dans les N derniers jours, décroissance exponentielle), pénalité si combinaison déjà générée récemment, bonus des items "loved" ;
   - assemble des candidats valides (top + bottom + chaussures, ou pièce traditionnelle complète, + outerwear/accessoires optionnels).
2. **Choix + explication par l'`AIProvider`** parmi les candidats (IDs uniquement). La réponse est validée par Zod et **chaque ID est revérifié comme appartenant à l'utilisateur** ; si l'IA échoue ou hallucine → fallback sur le meilleur candidat du moteur, avec explication générée par template. Erreur `AI_ERROR` uniquement si aucun candidat n'est possible (et alors message actionnable : "Ajoute des chaussures pour compléter tes looks").

Pas d'image générée (Règle 3) : l'outfit s'affiche en composition des **vraies photos** du dressing (Règle 4).

### Style learning

`StyleProfileService.recompute(userId)` : agrège ratings (`OutfitFeedback`), wear history et onboarding → met à jour `StylePreference` (poids couleurs/styles/occasions, items rejetés). Déclenché de façon asynchrone après feedback/wear (simple file en mémoire via `EventEmitter2` pour le MVP, remplaçable par une queue plus tard). `analyzeStyle()` (PREMIUM) produit un résumé textuel.

### Mobile (Expo SDK 57)

- Expo Router, TanStack Query (cache, retry, optimistic UI), Zustand (session, brouillon onboarding/ajout item), React Hook Form + Zod.
- UI : `react-native-reanimated` 4, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `lucide-react-native`, `expo-image` (cache + placeholder blurhash), `@shopify/flash-list` (grille closet), `expo-haptics`, `expo-image-picker` / `expo-camera`, `expo-secure-store` (refresh token — jamais AsyncStorage), Manrope via `@expo-google-fonts/manrope`.
- Design system maison typé dans `packages/config/tokens` + composants `ui/` (Button, Card, Chip, Sheet, Skeleton, EmptyState, ErrorState, Screen, Text). Pas de NativeWind : des tokens typés + `StyleSheet` évitent les soucis d'instance singleton rencontrés sur Fittrack et donnent un contrôle fin pour le rendu premium.
- Navigation : 5 onglets, **AI Stylist au centre** avec bouton surélevé (accent `#B79B72`, léger glow, haptic au tap). Paywall et détail outfit en modals.
- Client API unique avec intercepteur de refresh (une seule requête de refresh en vol, file d'attente des requêtes 401), mapping des codes d'erreur → UI (`LIMIT_REACHED` ouvre le paywall avec le contexte).

### Admin (Next.js)

App Router + quelques tables simples : users, subscriptions, items, outfits, usage IA, métriques de base. Authentification via l'API avec `User.role = ADMIN`, endpoints `/api/admin/*` protégés par `RolesGuard`. Pas de dashboard complexe.

### Tests

- API : Jest + Supertest ; e2e sur une base Postgres de test (schéma dédié, reset entre suites). Unitaires sur le moteur de candidats, usage limits, rotation refresh token.
- Mobile : `jest-expo` + React Native Testing Library + `expo-router/testing-library` pour la navigation.

## 3. Modèle de données (Prisma)

Les entités demandées, plus quatre ajouts **nécessaires** à la sécurité et au fonctionnement (signalés ★) :

- `User` (id, email unique, passwordHash, firstName, lastName, avatarUrl, ★`role`, timestamps)
- ★`RefreshToken` (tokenHash, familyId, userId, expiresAt, revokedAt, replacedById)
- ★`PasswordResetToken` (codeHash, userId, expiresAt, usedAt)
- `Profile` (userId unique, gender/stylePreference, city, onboardingCompletedAt, notificationsEnabled)
- `StylePreference` (userId unique, preferredColors[], preferredStyles[], preferredOccasions[], dislikedItems[], metadata Json — poids appris)
- `ClothingItem` (+ `thumbnailUrl`, `imageKey`, `isFavorite`, `archivedAt` — suppression douce pour ne pas casser l'historique des outfits)
- `Outfit` (+ `isSaved`, `constraints` Json, `weatherSnapshot` Json)
- `OutfitItem` (outfitId + clothingItemId, PK composite, `position`)
- `OutfitFeedback` (outfitId, userId, rating LOVE/DISLIKE, unique par outfit+user)
- `WearHistory`, `CalendarEvent` (unique userId+date pour le MVP : un look par jour)
- `Subscription` (plan FREE/PRO/PREMIUM, status, provider, providerRef, currentPeriodEnd)
- `Usage` (userId, metric, periodStart, count — unique sur le triplet, incrément atomique)
- ★`AnalyticsEvent` (optionnel, utile pour les métriques admin en dev)

Index : `(userId, category)`, `(userId, createdAt)` sur ClothingItem/Outfit, `(userId, wornAt)` sur WearHistory, `(userId, date)` sur CalendarEvent, `(userId, metric, periodStart)` sur Usage, `email` unique.

Seed : 2 utilisateurs de démo (FREE et PRO) + 1 admin, ~40 vêtements avec vraies photos libres de droits stockées localement dans le repo (`apps/api/prisma/seed-assets`), outfits, feedback, historique et événements calendrier. Mots de passe de démo générés et écrits dans `.env.example`/README comme valeurs de dev (Règle 10 : aucun credential externe inventé).

## 4. Plans & limites

|                                           | FREE              | PRO                        | PREMIUM           |
| ----------------------------------------- | ----------------- | -------------------------- | ----------------- |
| Vêtements                                 | 30                | illimité                   | illimité          |
| Générations d'outfit                      | 3 / semaine       | ★5 / jour                  | ★20 / jour        |
| Analyses IA de vêtement                   | ★30 / mois        | ★illimité (fair use 100/j) | idem              |
| Météo, calendrier, historique             | ★voir question Q3 | ✔                          | ✔                 |
| Analyse de style, event styling, shopping | —                 | —                          | ✔                 |
| Prix                                      | —                 | 2 500 FCFA / mois          | 5 000 FCFA / mois |

★ = valeur que je propose, la spec ne la précise pas. Les limites vivent dans `packages/shared/plans.ts` (une seule source). `UsageGuard` + décorateur `@Metered('OUTFIT_GENERATION')` : vérification **et** incrément dans une transaction ; incrément annulé si l'appel IA échoue. Réponse `402` :

```json
{
  "error": {
    "code": "LIMIT_REACHED",
    "message": "...",
    "details": {
      "metric": "OUTFIT_GENERATION",
      "limit": 3,
      "used": 3,
      "resetsAt": "2026-10-20T00:00:00Z",
      "currentPlan": "FREE",
      "suggestedPlan": "PRO"
    }
  }
}
```

Paywall sans dark patterns : bouton fermer visible immédiatement, prix mensuel clair, pas de faux compte à rebours, annulation accessible depuis Profil.

## 5. Phases (ordre de la spec), critères de "terminé"

Après chaque phase : `pnpm typecheck && pnpm lint && pnpm test` verts + vérification réelle (requête HTTP ou écran lancé) + README mis à jour + commit git.

| #   | Phase                      | Livrables                                                                                                                                                   | Vérification                                                                         |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Monorepo & config          | git init, pnpm workspaces (hoisted), Turborepo, packages config/shared/types, squelettes api/mobile/admin, docker-compose, `.env.example`, validation d'env | `pnpm install`, `pnpm typecheck/lint` verts, API `GET /api/health` 200, Expo démarre |
| 2   | DB                         | Schéma Prisma complet, migration initiale, seed                                                                                                             | `db:migrate` + `db:seed` sur Postgres Docker, comptage des lignes                    |
| 3   | Auth                       | register/login/logout/refresh/forgot/reset, guards, filtre d'erreurs, throttling, helmet, Swagger                                                           | Tests e2e auth (dont réutilisation de refresh token)                                 |
| 4   | Navigation + design system | Tokens, polices, i18n FR/EN (FR par défaut), composants ui, tabs avec Stylist central, écrans auth, routes protégées                                        | Tests composants + navigation ; capture Expo Web                                     |
| 5   | Onboarding                 | 8 étapes animées, progression, persistance brouillon, `PUT /api/profile`                                                                                    | Parcours complet → profil en base                                                    |
| 6   | Closet                     | CRUD API + ownership, grille FlashList, recherche, filtres catégories, détail, bottom sheet d'édition                                                       | Tests e2e closet + ownership                                                         |
| 7   | Storage                    | StorageService local + S3 (MinIO), pipeline upload sécurisé, URLs signées                                                                                   | Upload réel vers MinIO, rejet d'un faux JPEG                                         |
| 8   | Analyse IA                 | `POST /api/ai/analyze-clothing`, provider mock + réel, écran d'ajout photo → résultats éditables → sauvegarde                                               | Flux complet avec le mock                                                            |
| 9   | AI Stylist                 | Écran occasion/style/contraintes, moteur de candidats, `POST /api/ai/generate-outfit`, animation de génération                                              | Tests unitaires moteur, e2e génération                                               |
| 10  | Outfit detail + feedback   | Composition photos, explication, save / wear today / try another, Love it / Not for me                                                                      | e2e feedback, optimistic UI                                                          |
| 11  | Calendar + wear history    | Calendrier mensuel, assignation via bottom sheet, passé/futur, anti-répétition branchée au moteur                                                           | e2e calendrier, test pénalité récence                                                |
| 12  | Style preferences          | Recalcul du profil, écran d'édition des préférences                                                                                                         | Test : 3 dislikes → item exclu                                                       |
| 13  | Météo                      | WeatherService + mock + Open-Meteo, widget Home, intégration au scoring                                                                                     | Test : pluie → pas de sandales                                                       |
| 14  | Usage limits               | `Usage`, guard, réponse `LIMIT_REACHED`                                                                                                                     | Tests limites FREE/PRO, reset de période                                             |
| 15  | Subscriptions/paywall      | BillingProvider mock, endpoints, écran paywall, écran Subscription                                                                                          | Upgrade mock → limites levées                                                        |
| 16  | Analytics                  | AnalyticsService + mock, 11 événements branchés                                                                                                             | Test : événements émis                                                               |
| 17  | Tests                      | Compléter la couverture des chemins critiques listés §31                                                                                                    | Rapport de couverture                                                                |
| 18  | Polish + QA                | Home complet (Today's Look, stats, weekly preview), skeletons/empty/error partout, animations, admin Next.js, petits/grands iPhones, docs                   | Passe QA écran par écran                                                             |

Note : l'admin Next.js n'a pas de phase dédiée dans la spec ; je le place en Phase 18 (il ne bloque rien).

## 6. Points d'attention

1. **Apple / Google et les abonnements** : une app iOS qui vend un abonnement à du contenu numérique _dans l'app_ doit en principe passer par l'In-App Purchase d'Apple (Google Play Billing côté Android). Un paiement Mobile Money (Wave, Orange Money via CinetPay/PayDunya…) en FCFA dans l'app risque un rejet en review. L'abstraction `BillingProvider` permet de brancher RevenueCat (IAP) et/ou un paiement web plus tard ; le MVP reste en mock. Décision business à prendre avant la mise en production, pas avant de coder.
2. **Coût IA** : l'analyse photo est l'appel le plus coûteux ; images redimensionnées avant envoi, réponses mises en cache par `imageKey`.
3. **Photos** : suppression des métadonnées EXIF/GPS à l'upload (vie privée).
4. Les termes UI de la spec sont en anglais (`"What are you dressing for?"`) alors que le marché est francophone (FCFA) → voir Q1.

## 7. Décisions validées (2026-10-17)

- **Langue** : FR + EN via i18n dès la Phase 4, FR par défaut ; les libellés anglais de la spec servent de version EN.
- **IA** : mock uniquement pour le MVP. Aucun fournisseur réel n'est intégré ; `AIProvider` reste l'unique point d'extension (ajouter une implémentation + une valeur `AI_PROVIDER`). Le mock doit donc être assez bon pour porter seul l'expérience : moteur de règles complet, explications par templates variés et contextualisés (occasion, météo, couleurs).
- **Gating FREE** : météo sur Home + calendrier de la semaine en cours ; planification au-delà et historique complet = PRO.
- **Quotas** : valeurs ★ du §4 validées (PRO 5 générations/jour, PREMIUM 20/jour, FREE 30 analyses/mois).
