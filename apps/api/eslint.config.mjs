import base from '@vyra/config/eslint';
import globals from 'globals';

export default [
  ...base,
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: ['jest.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Nest resolves constructor dependencies through emitted decorator metadata,
    // which needs value imports: `import type` would erase the injection token.
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
