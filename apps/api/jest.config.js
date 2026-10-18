const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Reuse the build's SWC options, minus `exclude` (it drops spec files from the build).
const { exclude: _buildExclude, ...swcConfig } = JSON.parse(
  readFileSync(join(__dirname, '.swcrc'), 'utf8'),
);

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test', '<rootDir>/prisma'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': ['@swc/jest', { ...swcConfig, swcrc: false }],
  },
  // The generated Prisma client imports its own TS files with '.js' extensions (ESM style).
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // e2e tests register users (argon2 is slow on purpose) and run several
  // generations; 5 s is too tight when API and mobile suites share the CPU.
  testTimeout: 30_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/generated/**'],
};
