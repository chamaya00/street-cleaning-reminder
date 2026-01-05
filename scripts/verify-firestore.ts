#!/usr/bin/env tsx
/**
 * Firestore Verification Script
 *
 * Verifies that Firebase/Firestore is properly configured and accessible.
 * Run with: npx tsx scripts/verify-firestore.ts
 *
 * Checks:
 * 1. Required environment variables are set
 * 2. Firebase Admin SDK can initialize
 * 3. Firestore read/write operations work
 * 4. Required collections exist (optional)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

const results: CheckResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function addResult(result: CheckResult) {
  results.push(result);
  const emoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  log(emoji, `${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
}

async function checkEnvironmentVariables(): Promise<boolean> {
  log('🔍', 'Checking environment variables...\n');

  const requiredVars = [
    { name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', secret: false },
    { name: 'FIREBASE_ADMIN_CLIENT_EMAIL', secret: true },
    { name: 'FIREBASE_ADMIN_PRIVATE_KEY', secret: true },
  ];

  const optionalVars = [
    { name: 'NEXT_PUBLIC_FIREBASE_API_KEY', secret: false },
    { name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', secret: false },
  ];

  let allRequiredPresent = true;

  for (const { name, secret } of requiredVars) {
    const value = process.env[name];
    if (!value) {
      addResult({
        name,
        status: 'fail',
        message: 'NOT SET (required)',
        details: 'This variable is required for Firebase Admin SDK',
      });
      allRequiredPresent = false;
    } else {
      const displayValue = secret ? `${value.substring(0, 10)}...` : value;
      addResult({
        name,
        status: 'pass',
        message: `Set: ${displayValue}`,
      });
    }
  }

  console.log('');

  for (const { name, secret } of optionalVars) {
    const value = process.env[name];
    if (!value) {
      addResult({
        name,
        status: 'warn',
        message: 'NOT SET (optional for server-side)',
        details: 'Only needed for client-side Firebase',
      });
    } else {
      const displayValue = secret ? `${value.substring(0, 10)}...` : value;
      addResult({
        name,
        status: 'pass',
        message: `Set: ${displayValue}`,
      });
    }
  }

  return allRequiredPresent;
}

async function checkFirebaseConnection(): Promise<boolean> {
  console.log('\n');
  log('🔌', 'Testing Firebase connection...\n');

  try {
    // Dynamic import to avoid errors if env vars aren't set
    const { getAdminDb } = await import('../lib/firebase-admin');
    const db = getAdminDb();

    addResult({
      name: 'Firebase Admin SDK',
      status: 'pass',
      message: 'Initialized successfully',
    });

    // Test write operation
    const testDoc = {
      _verificationTest: true,
      timestamp: new Date().toISOString(),
      message: 'Firestore verification test',
    };

    const docRef = await db.collection('_verification_tests').add(testDoc);
    addResult({
      name: 'Firestore Write',
      status: 'pass',
      message: `Document created: ${docRef.id}`,
    });

    // Test read operation
    const readDoc = await docRef.get();
    if (readDoc.exists && readDoc.data()?._verificationTest === true) {
      addResult({
        name: 'Firestore Read',
        status: 'pass',
        message: 'Document read successfully',
      });
    } else {
      addResult({
        name: 'Firestore Read',
        status: 'fail',
        message: 'Document read failed or data mismatch',
      });
    }

    // Cleanup test document
    await docRef.delete();
    addResult({
      name: 'Firestore Delete',
      status: 'pass',
      message: 'Test document cleaned up',
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addResult({
      name: 'Firebase Connection',
      status: 'fail',
      message: 'Failed to connect',
      details: errorMessage,
    });
    return false;
  }
}

async function checkCollections(): Promise<void> {
  console.log('\n');
  log('📂', 'Checking Firestore collections...\n');

  try {
    const { getAdminDb } = await import('../lib/firebase-admin');
    const db = getAdminDb();

    const collections = ['blocks', 'users', 'subscriptions', 'notificationSets', 'sentNotifications'];

    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).limit(1).get();
        const count = snapshot.size;
        const hasData = count > 0;

        if (collectionName === 'blocks') {
          // blocks collection should have data for the app to work
          if (hasData) {
            const fullSnapshot = await db.collection('blocks').count().get();
            const totalCount = fullSnapshot.data().count;
            addResult({
              name: `Collection: ${collectionName}`,
              status: 'pass',
              message: `${totalCount} documents found`,
            });
          } else {
            addResult({
              name: `Collection: ${collectionName}`,
              status: 'warn',
              message: 'Empty - run "npm run upload-blocks" to populate',
            });
          }
        } else {
          // Other collections may be empty initially
          addResult({
            name: `Collection: ${collectionName}`,
            status: 'pass',
            message: hasData ? 'Has documents' : 'Exists (empty - normal for new setup)',
          });
        }
      } catch (error) {
        addResult({
          name: `Collection: ${collectionName}`,
          status: 'warn',
          message: 'Could not check',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    addResult({
      name: 'Collections Check',
      status: 'fail',
      message: 'Failed to check collections',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

function printSummary(): void {
  console.log('\n');
  console.log('═'.repeat(50));
  console.log('                 VERIFICATION SUMMARY');
  console.log('═'.repeat(50));

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}`);

  if (failed === 0) {
    console.log('\n🎉 Your Firestore setup is working correctly!');
  } else {
    console.log('\n🔧 Some issues need to be fixed. See details above.');
  }

  console.log('\n' + '═'.repeat(50));
}

function printNextSteps(): void {
  const hasFailed = results.some((r) => r.status === 'fail');

  console.log('\n📋 NEXT STEPS:\n');

  if (hasFailed) {
    console.log('1. Create/update your .env.local file with Firebase credentials:');
    console.log('   cp .env.local.example .env.local');
    console.log('   # Then edit .env.local with your values\n');
    console.log('2. Get credentials from Firebase Console:');
    console.log('   - Go to https://console.firebase.google.com');
    console.log('   - Select your project (or create one)');
    console.log('   - Project Settings > Service Accounts > Generate New Private Key');
    console.log('   - Copy values to your .env.local\n');
    console.log('3. Re-run this verification:');
    console.log('   npx tsx scripts/verify-firestore.ts\n');
  } else {
    const blocksEmpty = results.find(
      (r) => r.name === 'Collection: blocks' && r.status === 'warn'
    );
    if (blocksEmpty) {
      console.log('1. Populate the blocks collection:');
      console.log('   npm run seed-blocks     # Generate sample blocks');
      console.log('   npm run upload-blocks   # Upload to Firestore\n');
    }
    console.log('2. Run integration tests:');
    console.log('   npm run test:integration\n');
    console.log('3. Start the development server:');
    console.log('   npm run dev\n');
  }
}

async function main() {
  console.log('\n' + '═'.repeat(50));
  console.log('       FIRESTORE VERIFICATION SCRIPT');
  console.log('═'.repeat(50) + '\n');

  const envOk = await checkEnvironmentVariables();

  if (envOk) {
    const connectionOk = await checkFirebaseConnection();
    if (connectionOk) {
      await checkCollections();
    }
  }

  printSummary();
  printNextSteps();

  // Exit with error code if any checks failed
  const hasFailed = results.some((r) => r.status === 'fail');
  process.exit(hasFailed ? 1 : 0);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
