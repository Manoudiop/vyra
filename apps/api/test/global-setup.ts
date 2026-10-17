import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import './setup-env';

/**
 * Creates the dedicated test database if needed and applies migrations, so
 * e2e suites run against the real schema without touching the dev database.
 */
export default async function globalSetup(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL!);
  const database = url.pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to run tests against non-test database "${database}"`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach PostgreSQL for tests (${url.host}). Start it with "pnpm db:up".\n${String(error)}`,
    );
  }
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'pipe',
  });
}
