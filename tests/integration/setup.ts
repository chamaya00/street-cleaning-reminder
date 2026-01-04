/**
 * Setup file for integration tests.
 * Loads environment variables from .env.local if available.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local for local development
config({ path: resolve(process.cwd(), '.env.local') });

// Validate required environment variables for integration tests
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.error('\n⚠️  Missing required environment variables for integration tests:');
  missingVars.forEach((v) => console.error(`   - ${v}`));
  console.error('\nSet these in .env.local or as environment variables.\n');
  process.exit(1);
}

console.log('✅ All required environment variables are set');
