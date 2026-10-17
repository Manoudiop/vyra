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
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': ['@swc/jest', { ...swcConfig, swcrc: false }],
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
