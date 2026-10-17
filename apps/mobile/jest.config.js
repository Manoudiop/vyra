/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // pnpm hoists into the workspace root; transform RN/Expo packages and our TS workspace packages.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|react-navigation|@react-navigation/.*|@vyra/.*))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
