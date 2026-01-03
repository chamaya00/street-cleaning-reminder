/**
 * Upload blocks from marina-blocks.json to Firestore
 *
 * Usage:
 *   npx tsx scripts/upload-blocks.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface BlockData {
  id: string;
  streetName: string;
  blockNumber: number;
  cnn: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
  northSchedule: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    frequency: string;
  } | null;
  southSchedule: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    frequency: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

async function main(): Promise<void> {
  console.log('Upload Blocks to Firestore');
  console.log('==========================\n');

  // Check for blocks file
  const blocksPath = path.join(process.cwd(), 'scripts', 'marina-blocks.json');
  if (!fs.existsSync(blocksPath)) {
    console.error('Error: marina-blocks.json not found.');
    console.log('Run one of these first:');
    console.log('  npx tsx scripts/seed-sample-blocks.ts  # Generate sample data');
    console.log('  npx tsx scripts/import-blocks.ts       # Import from SF DataSF API');
    process.exit(1);
  }

  // Load blocks
  const blocksData: BlockData[] = JSON.parse(fs.readFileSync(blocksPath, 'utf-8'));
  console.log(`Loaded ${blocksData.length} blocks from marina-blocks.json`);

  // Check for required environment variables
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('\nError: Firebase credentials not configured.');
    console.log('Set the following environment variables in .env.local:');
    console.log('  NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    console.log('  FIREBASE_ADMIN_CLIENT_EMAIL');
    console.log('  FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }

  console.log(`\nConnecting to Firebase project: ${projectId}`);

  // Initialize Firebase Admin
  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  const db = getFirestore(app);
  const blocksCollection = db.collection('blocks');

  // Upload in batches
  const BATCH_SIZE = 500;
  let uploaded = 0;

  for (let i = 0; i < blocksData.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchBlocks = blocksData.slice(i, i + BATCH_SIZE);

    for (const block of batchBlocks) {
      const docRef = blocksCollection.doc(block.id);
      batch.set(docRef, {
        streetName: block.streetName,
        blockNumber: block.blockNumber,
        cnn: block.cnn,
        geometry: block.geometry,
        northSchedule: block.northSchedule,
        southSchedule: block.southSchedule,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
    uploaded += batchBlocks.length;
    console.log(`Uploaded ${uploaded}/${blocksData.length} blocks`);
  }

  console.log('\nUpload complete!');
  console.log(`\nYou can verify by running: firebase firestore:get blocks --limit 5`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
