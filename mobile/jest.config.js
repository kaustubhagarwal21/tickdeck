/** Jest for the mobile app. jest-expo sets up Babel and the React Native mocks. */
module.exports = {
  preset: 'jest-expo',
  // Same mapping as tsconfig.json "paths" and metro.config.js.
  moduleNameMapper: {
    '^@tickdeck/core$': '<rootDir>/../packages/core/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist-web/'],
};
