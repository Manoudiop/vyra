// Shared flat ESLint config for VYRA TypeScript packages (API, shared libs).
// Apps with their own framework preset (Expo, Next.js) compose on top of theirs.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**', '**/node_modules/**'],
};

export default tseslint.config(ignores, js.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: {
    globals: { ...globals.node },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'smart'],
  },
});
