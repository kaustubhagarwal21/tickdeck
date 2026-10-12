import type { Config } from 'jest';
import nextJest from 'next/jest.js';

// next/jest compiles TypeScript and JSX with Next's own compiler (SWC), loads
// next.config.ts and .env files, and replaces CSS and image imports with stubs.
const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  // jsdom gives tests a browser-like `window` and `document`.
  testEnvironment: 'jsdom',
  // Runs before each test file: adds matchers such as toBeInTheDocument().
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // The same import aliases as tsconfig.json "paths": "@/..." for the web app's
  // own files, and "@tickdeck/core" for the shared package in packages/core.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tickdeck/core$': '<rootDir>/packages/core/src/index.ts',
  },
  // Jest looks for tests in the whole project (`roots` defaults to <rootDir>),
  // so it runs both src/**/__tests__ and packages/core/src/**/__tests__.
  // Skipped: e2e/ holds Playwright tests, which run in a real browser via
  // `npm run test:e2e`; mobile/ is the Expo app, which has its own package.json
  // and runs its own tests.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '<rootDir>/mobile/',
  ],
  // Also hide mobile/ from Jest's module lookup, so its package.json and
  // node_modules cannot clash with the web app's.
  modulePathIgnorePatterns: ['<rootDir>/mobile/'],
  // Reset jest.fn() call history between tests so tests cannot leak into each other.
  clearMocks: true,
  // Note: every test gets __mocks__/lightweight-charts.ts instead of the real
  // chart library (Jest uses a root __mocks__ file for a node_modules package
  // automatically). See that file for why.
};

export default createJestConfig(config);
