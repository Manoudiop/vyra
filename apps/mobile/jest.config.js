/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // pnpm hoists into the workspace root; transform RN/Expo packages and our TS workspace packages.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|react-navigation|@react-navigation/.*|standard-navigation|@vyra/.*))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Its "react-native" export condition points at untransformed .mjs; use the CJS build in tests.
    '^lucide-react-native$': require.resolve('lucide-react-native'),
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
