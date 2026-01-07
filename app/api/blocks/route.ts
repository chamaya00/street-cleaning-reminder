import { NextResponse } from 'next/server';
import type { BlockWithId, GetBlocksResponse, CleaningSchedule } from '@/lib/types';
import sampleBlocks from '@/scripts/marina-blocks.json';

// Schedule format from Firestore streetSegments collection
interface FirestoreSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

// Raw document from streetSegments collection
interface StreetSegmentDoc {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
  schedules: FirestoreSchedule[];
  syncVersion: string;
}

// Convert weeksOfMonth array to frequency string
function weeksToFrequency(weeks: number[]): CleaningSchedule['frequency'] {
  const sorted = [...weeks].sort();
  const key = sorted.join(',');

  if (key === '1,2,3,4') return 'weekly';
  if (key === '1,3') return '1st_3rd';
  if (key === '2,4') return '2nd_4th';
  if (key === '1') return '1st';
  if (key === '2') return '2nd';
  if (key === '3') return '3rd';
  if (key === '4') return '4th';

  return 'weekly';
}

// Parse block number from address
function parseBlockNumber(fromAddress: string): number {
  if (!fromAddress) return 0;
  const match = fromAddress.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    return Math.floor(num / 100) * 100;
  }
  return 0;
}

// Transform streetSegment doc to BlockWithId format
function transformSegmentToBlock(doc: StreetSegmentDoc): BlockWithId {
  let northSchedule: CleaningSchedule | null = null;
  let southSchedule: CleaningSchedule | null = null;

  for (const schedule of doc.schedules) {
    const cleaningSchedule: CleaningSchedule = {
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      frequency: weeksToFrequency(schedule.weeksOfMonth),
    };

    if (schedule.side === 'North' || schedule.side === 'Both') {
      northSchedule = cleaningSchedule;
    }
    if (schedule.side === 'South' || schedule.side === 'Both') {
      southSchedule = cleaningSchedule;
    }
  }

  return {
    id: doc.cnn,
    streetName: doc.streetName,
    blockNumber: parseBlockNumber(doc.fromAddress),
    cnn: doc.cnn,
    geometry: doc.geometry as BlockWithId['geometry'],
    northSchedule,
    southSchedule,
  };
}

async function fetchBlocksFromFirestore(): Promise<BlockWithId[]> {
  // Only attempt Firebase if credentials are configured
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    throw new Error('Firebase not configured');
  }

  const { getAdminDb } = await import('@/lib/firebase-admin');
  const db = getAdminDb();

  // First try the new streetSegments collection
  const streetSegmentsSnapshot = await db.collection('streetSegments').get();

  if (!streetSegmentsSnapshot.empty) {
    console.log(`[api/blocks] Loaded ${streetSegmentsSnapshot.size} segments from streetSegments collection`);
    return streetSegmentsSnapshot.docs.map((doc) =>
      transformSegmentToBlock(doc.data() as StreetSegmentDoc)
    );
  }

  // Fall back to legacy blocks collection if streetSegments is empty
  console.log('[api/blocks] streetSegments collection empty, trying legacy blocks collection');
  const blocksSnapshot = await db.collection('blocks').get();

  if (!blocksSnapshot.empty) {
    console.log(`[api/blocks] Loaded ${blocksSnapshot.size} blocks from legacy blocks collection`);
    return blocksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as BlockWithId));
  }

  throw new Error('No blocks found in Firestore');
}

function getSampleBlocks(): BlockWithId[] {
  return sampleBlocks as BlockWithId[];
}

export async function GET(): Promise<NextResponse<GetBlocksResponse | { error: string }>> {
  try {
    const blocks = await fetchBlocksFromFirestore();
    return NextResponse.json({ blocks });
  } catch (error) {
    // Fall back to sample data if Firebase is not configured or fails
    console.log('[api/blocks] Using sample blocks data (Firebase not available):', error);
    const blocks = getSampleBlocks();
    return NextResponse.json({ blocks });
  }
}
