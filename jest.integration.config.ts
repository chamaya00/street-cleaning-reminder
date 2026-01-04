import type { Config } from 'jest';

/**
 * Jest configuration for integration tests.
 * These tests run against real external services (Firebase, Twilio)
 * and require actual credentials to be set in environment variables.
 */
const config: Config = {
  // Use Node environment for server-side integration tests
  testEnvironment: 'node',

  // Only run integration tests
  testMatch: ['**/*.integration.test.ts'],

  // Transform TypeScript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },

  // Module path aliases (matching tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Longer timeout for network requests
  testTimeout: 30000,

  // Load environment variables from .env.local if present
  setupFiles: ['<rootDir>/tests/integration/setup.ts'],

  // Don't collect coverage for integration tests
  collectCoverage: false,

  // Run tests sequentially to avoid rate limiting
  maxWorkers: 1,
};

export default config;
