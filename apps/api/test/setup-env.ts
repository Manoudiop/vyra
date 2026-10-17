// Deterministic environment for the test suite (no .env file is read in tests).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://vyra:vyra_dev_password@localhost:5440/vyra_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef012345678';
process.env.CORS_ORIGINS ??= 'http://localhost:4101';
