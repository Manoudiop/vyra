// Generates Expo Router typed-route declarations (.expo/types/router.d.ts) without
// starting Metro, so `pnpm typecheck` works on a fresh clone and in CI.
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
process.env.EXPO_ROUTER_APP_ROOT = path.join(projectRoot, 'app');

const typedRoutes = require(
  require.resolve('@expo/router-server/build/typed-routes', {
    paths: [require.resolve('expo/package.json')],
  }),
);
const typesDirectory = path.join(projectRoot, '.expo/types');
require('node:fs').mkdirSync(typesDirectory, { recursive: true });
typedRoutes.regenerateDeclarations(typesDirectory, {});
