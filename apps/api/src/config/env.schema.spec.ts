import { validateEnv } from './env.schema';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://vyra:pw@localhost:5433/vyra',
  JWT_ACCESS_SECRET: 'dev-only-access-secret-change-me-0123456789abcdef',
  JWT_REFRESH_SECRET: 'dev-only-refresh-secret-change-me-0123456789abcdef',
};

describe('validateEnv', () => {
  it('applies defaults for a minimal development config', () => {
    const env = validateEnv({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(env.API_PORT).toBe(4100);
    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rejects missing and too-short secrets without echoing values', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short-secret' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short-secret' })).not.toThrow(
      /short-secret/,
    );
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL/);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(() => validateEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow(
      /must differ/,
    );
  });

  it('requires S3 settings when the s3 driver is selected', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
  });

  it('refuses development secrets and local storage in production', () => {
    const run = () => validateEnv({ ...base, NODE_ENV: 'production' });
    expect(run).toThrow(/development secret used in production/);
    expect(run).toThrow(/local storage is for development only/);
  });

  it('accepts a correct production config', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db.internal:5432/vyra',
      JWT_ACCESS_SECRET: 'p'.repeat(48),
      JWT_REFRESH_SECRET: 'q'.repeat(48),
      CORS_ORIGINS: 'https://admin.vyra.app',
      STORAGE_DRIVER: 's3',
      S3_REGION: 'auto',
      S3_BUCKET: 'vyra',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(env.NODE_ENV).toBe('production');
  });
});
