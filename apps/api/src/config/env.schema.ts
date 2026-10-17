import { z } from 'zod';

const DEV_SECRET_PREFIX = 'dev-only-';

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    CORS_ORIGINS: commaList,

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    AI_PROVIDER: z.enum(['mock']).default('mock'),
    WEATHER_PROVIDER: z.enum(['mock', 'open-meteo']).default('mock'),
    BILLING_PROVIDER: z.enum(['mock']).default('mock'),
    ANALYTICS_PROVIDER: z.enum(['mock']).default('mock'),
    MAIL_PROVIDER: z.enum(['mock']).default('mock'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./uploads'),
    PUBLIC_API_URL: z.url().default('http://localhost:4100'),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanString,
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'must differ from JWT_ACCESS_SECRET',
      });
    }

    if (env.STORAGE_DRIVER === 's3') {
      for (const key of [
        'S3_REGION',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'required when STORAGE_DRIVER=s3' });
        }
      }
    }

    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (env[key].startsWith(DEV_SECRET_PREFIX)) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'development secret used in production',
          });
        }
      }
      if (env.STORAGE_DRIVER === 'local') {
        ctx.addIssue({
          code: 'custom',
          path: ['STORAGE_DRIVER'],
          message: 'local storage is for development only',
        });
      }
      if (env.CORS_ORIGINS.includes('*')) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'wildcard not allowed' });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment variables. Throws a readable error listing every
 * invalid key — never their values, which may be secrets.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
