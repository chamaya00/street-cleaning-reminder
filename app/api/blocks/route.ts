import { NextResponse } from 'next/server';
import type { Block, BlockWithId, GetBlocksResponse } from '@/lib/types';
import sampleBlocks from '@/scripts/marina-blocks.json';

async function fetchBlocksFromFirestore(): Promise<BlockWithId[]> {
  // Only attempt Firebase if credentials are configured
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    throw new Error('Firebase not configured');
  }

  const { getAdminDb } = await import('@/lib/firebase-admin');
  const db = getAdminDb();
  const blocksSnapshot = await db.collection('blocks').get();

  return blocksSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Block),
  }));
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
    console.log('Using sample blocks data (Firebase not available)');
    const blocks = getSampleBlocks();
    return NextResponse.json({ blocks });
  }
}
