import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Module path aliases (matching tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)',
  ],

  // Exclude integration tests from default run (use npm run test:integration)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '\\.integration\\.test\\.ts$',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
