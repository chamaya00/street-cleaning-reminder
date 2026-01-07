import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getAdminDb } from '@/lib/firebase-admin';
import { getSessionUser } from '@/lib/auth';
import { computeNotificationSets, type BlockWithId } from '@/lib/notification-sets';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
  UpdateSubscriptionsRequest,
  UpdateSubscriptionsResponse,
  NotificationSet,
  CleaningSchedule,
} from '@/lib/types';

// Types for reading street segments from JSON file
interface SegmentSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

interface GeoJSONGeometry {
  type: string;
  coordinates: number[][] | number[][][] | number[];
}

interface StreetSegment {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  geometry: GeoJSONGeometry;
  schedules: SegmentSchedule[];
}

interface StreetSegmentsFile {
  version: string;
  generatedAt: string;
  count: number;
  segments: StreetSegment[];
}

// Cache for loaded segments
let cachedSegments: StreetSegmentsFile | null = null;
let cacheTime: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

function loadSegmentsFromFile(): StreetSegmentsFile {
  const now = Date.now();

  if (cachedSegments && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedSegments;
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'street-segments.json');

  if (!fs.existsSync(filePath)) {
    throw new Error('Street segments file not found');
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  cachedSegments = JSON.parse(fileContent) as StreetSegmentsFile;
  cacheTime = now;

  return cachedSegments;
}

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

function parseBlockNumber(fromAddress: string): number {
  if (!fromAddress) return 0;
  const match = fromAddress.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    return Math.floor(num / 100) * 100;
  }
  return 0;
}

function getBlocksFromJsonFile(blockIds: string[]): BlockWithId[] {
  const data = loadSegmentsFromFile();
  const blockIdSet = new Set(blockIds);

  return data.segments
    .filter(segment => blockIdSet.has(segment.cnn))
    .map(segment => {
      let northSchedule: CleaningSchedule | null = null;
      let southSchedule: CleaningSchedule | null = null;

      for (const schedule of segment.schedules) {
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
        id: segment.cnn,
        streetName: segment.streetName,
        blockNumber: parseBlockNumber(segment.fromAddress),
        cnn: segment.cnn,
        geometry: segment.geometry as BlockWithId['geometry'],
        northSchedule,
        southSchedule,
      };
    });
}

/**
 * GET /api/subscriptions
 * Returns the current user's subscribed block IDs
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { user } = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;
    const db = getAdminDb();
    const subscriptionsSnapshot = await db
      .collection('subscriptions')
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    const blockIds = subscriptionsSnapshot.docs.map((doc) => doc.data().blockId as string);

    return NextResponse.json({ blockIds });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subscriptions
 * Updates the user's subscriptions and recomputes notification sets.
 * Accepts { blockIds: string[] } and replaces all existing subscriptions.
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<UpdateSubscriptionsResponse | { error: string }>> {
  try {
    const { user } = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;

    const body = (await request.json()) as UpdateSubscriptionsRequest;
    const { blockIds } = body;

    if (!Array.isArray(blockIds)) {
      return NextResponse.json(
        { error: 'blockIds must be an array' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const batch = db.batch();

    // 1. Get current subscriptions
    const currentSubscriptionsSnapshot = await db
      .collection('subscriptions')
      .where('userId', '==', userId)
      .get();

    const currentBlockIds = new Set(
      currentSubscriptionsSnapshot.docs
        .filter((doc) => doc.data().active)
        .map((doc) => doc.data().blockId as string)
    );

    const newBlockIds = new Set(blockIds);

    // 2. Determine additions and removals
    const toAdd = blockIds.filter((id) => !currentBlockIds.has(id));
    const toRemove = [...currentBlockIds].filter((id) => !newBlockIds.has(id));

    // 3. Deactivate removed subscriptions
    for (const doc of currentSubscriptionsSnapshot.docs) {
      const blockId = doc.data().blockId as string;
      if (toRemove.includes(blockId)) {
        batch.update(doc.ref, { active: false });
      }
    }

    // 4. Add new subscriptions
    for (const blockId of toAdd) {
      const subscriptionRef = db.collection('subscriptions').doc();
      batch.set(subscriptionRef, {
        userId,
        blockId,
        createdAt: FieldValue.serverTimestamp(),
        active: true,
      });
    }

    // 5. Fetch blocks for computing notification sets from JSON file
    const subscribedBlocks: BlockWithId[] = blockIds.length > 0
      ? getBlocksFromJsonFile(blockIds)
      : [];

    // 6. Compute new notification sets
    const computedSets = computeNotificationSets(userId, subscribedBlocks);

    // 7. Get existing notification sets
    const existingSetsSnapshot = await db
      .collection('notificationSets')
      .where('userId', '==', userId)
      .get();

    const existingSetKeys = new Set(
      existingSetsSnapshot.docs.map((doc) => doc.data().setKey as string)
    );
    const newSetKeys = new Set(computedSets.map((s) => s.setKey));

    // 8. Delete notification sets that are no longer needed
    for (const doc of existingSetsSnapshot.docs) {
      const setKey = doc.data().setKey as string;
      if (!newSetKeys.has(setKey)) {
        batch.delete(doc.ref);
      }
    }

    // 9. Add or update notification sets
    const notificationSets: NotificationSet[] = [];
    const now = FieldValue.serverTimestamp();

    for (const set of computedSets) {
      if (existingSetKeys.has(set.setKey)) {
        // Update existing
        const existingDoc = existingSetsSnapshot.docs.find(
          (doc) => doc.data().setKey === set.setKey
        );
        if (existingDoc) {
          batch.update(existingDoc.ref, {
            ...set,
            updatedAt: now,
          });
          notificationSets.push({
            ...set,
            createdAt: existingDoc.data().createdAt,
            updatedAt: existingDoc.data().updatedAt,
          } as NotificationSet);
        }
      } else {
        // Create new
        const setRef = db.collection('notificationSets').doc();
        batch.set(setRef, {
          ...set,
          createdAt: now,
          updatedAt: now,
        });
        // For newly created sets, use a placeholder timestamp (will be updated by Firestore)
        const placeholderTimestamp = Timestamp.now();
        notificationSets.push({
          ...set,
          createdAt: placeholderTimestamp,
          updatedAt: placeholderTimestamp,
        } as unknown as NotificationSet);
      }
    }

    // 10. Commit all changes
    await batch.commit();

    return NextResponse.json({
      success: true,
      subscriptions: blockIds,
      notificationSets,
    });
  } catch (error) {
    console.error('Error updating subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to update subscriptions' },
      { status: 500 }
    );
  }
}
