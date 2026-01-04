import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Block, BlockWithId, GetBlocksResponse } from '@/lib/types';

export async function GET(): Promise<NextResponse<GetBlocksResponse | { error: string }>> {
  try {
    const db = getAdminDb();
    const blocksSnapshot = await db.collection('blocks').get();

    const blocks: BlockWithId[] = blocksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Block),
    }));

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blocks' },
      { status: 500 }
    );
  }
}
