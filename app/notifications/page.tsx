import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { NotificationsPageClient } from '@/components/notifications/NotificationsPageClient';
import { computeNextReminder, hasActiveAlert } from '@/lib/notification-utils';
import { computeNotificationSets, type BlockWithId } from '@/lib/notification-sets';
import type {
  NotificationSet,
  NotificationSetWithStatus,
  SentNotification,
  CleaningSchedule,
} from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

// Types for reading street segments from JSON file
interface SegmentSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

interface StreetSegment {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  schedules: SegmentSchedule[];
}

interface StreetSegmentsFile {
  segments: StreetSegment[];
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

function loadBlocksFromFile(blockIds: string[]): BlockWithId[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'street-segments.json');

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(fileContent) as StreetSegmentsFile;
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
        geometry: { type: 'LineString', coordinates: [] } as BlockWithId['geometry'],
        northSchedule,
        southSchedule,
      };
    });
}

interface NotificationsPageProps {
  searchParams: Promise<{ t?: string; blocks?: string }>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const alertToken = params.t;
  const pendingBlocks = params.blocks;

  // Check if user is authenticated (session or token)
  const { user } = await getAuthenticatedUser(alertToken);

  if (!user) {
    // For unauthenticated users, compute preview notification sets if blocks are provided
    let previewNotificationSets: NotificationSetWithStatus[] = [];

    if (pendingBlocks) {
      const blockIds = pendingBlocks.split(',').filter(id => id.trim());
      if (blockIds.length > 0) {
        const blocks = loadBlocksFromFile(blockIds);
        // Use a placeholder userId for preview computation
        const computedSets = computeNotificationSets('preview', blocks);

        // Convert to NotificationSetWithStatus format for preview
        previewNotificationSets = computedSets.map((set, index) => ({
          ...set,
          id: `preview-${index}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          isActive: false,
          nextReminderAt: null,
          nextReminderStage: null,
        })) as NotificationSetWithStatus[];
      }
    }

    return (
      <NotificationsPageClient
        isAuthenticated={false}
        previewNotificationSets={previewNotificationSets}
        pendingBlocks={pendingBlocks}
      />
    );
  }

  // Fetch notification data for authenticated user
  const db = getAdminDb();
  const now = new Date();

  // Fetch user's notification sets
  const notificationSetsSnapshot = await db
    .collection('notificationSets')
    .where('userId', '==', user.userId)
    .get();

  // Fetch active sent notifications (not acknowledged, cleaning not ended)
  const sentNotificationsSnapshot = await db
    .collection('sentNotifications')
    .where('userId', '==', user.userId)
    .where('cleaningEnd', '>', Timestamp.fromDate(now))
    .get();

  const sentNotifications: SentNotification[] = sentNotificationsSnapshot.docs.map(
    (doc) => doc.data() as SentNotification
  );

  // Build notification sets with status
  const notificationSets: NotificationSetWithStatus[] = notificationSetsSnapshot.docs.map(
    (doc) => {
      const setData = doc.data() as NotificationSet;
      const setId = doc.id;

      // Get sent notifications for this set
      const setSentNotifications = sentNotifications.filter(
        (sn) => sn.notificationSetId === setId
      );

      // Compute next reminder
      const { nextReminderAt, nextReminderStage } = computeNextReminder(
        setData.schedule,
        setSentNotifications,
        now
      );

      // Check if there's an active alert
      const isActive = hasActiveAlert(setId, sentNotifications, now);

      return {
        ...setData,
        id: setId,
        isActive,
        nextReminderAt,
        nextReminderStage,
      };
    }
  );

  return (
    <NotificationsPageClient
      isAuthenticated={true}
      userPhone={user.phone}
      alertToken={alertToken}
      initialNotificationSets={notificationSets}
    />
  );
}
