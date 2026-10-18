import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env files itself. Same precedence as the API:
// apps/api/.env first, then the repository-root .env. Already-set variables win.
loadEnv({ path: ['.env', '../../.env'], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
// Throwaway database Prisma resets to replay migrations (CI drift check).
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  // Optional so `prisma generate` (run on postinstall) works on a fresh clone
  // before .env exists; commands that touch the database still require it.
  ...(databaseUrl
    ? { datasource: { url: databaseUrl, ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}) } }
    : {}),
});
