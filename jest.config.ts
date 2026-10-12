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
  // Same "@/..." import alias as tsconfig.json.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // e2e/ holds Playwright tests, which run in a real browser via `npm run test:e2e`.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  // Reset jest.fn() call history between tests so tests cannot leak into each other.
  clearMocks: true,
  // Note: every test gets __mocks__/lightweight-charts.ts instead of the real
  // chart library (Jest uses a root __mocks__ file for a node_modules package
  // automatically). See that file for why.
};

export default createJestConfig(config);
