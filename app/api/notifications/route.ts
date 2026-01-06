import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { computeNextReminder, hasActiveAlert } from '@/lib/notification-utils';
import type {
  NotificationSet,
  NotificationSetWithStatus,
  SentNotification,
  GetNotificationsResponse,
} from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET /api/notifications
 * Returns the user's notification sets with status information
 * Supports authentication via session cookie or alertToken query parameter
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetNotificationsResponse | { error: string }>> {
  try {
    // Support both session and token-based auth
    const alertToken = request.nextUrl.searchParams.get('t') ?? undefined;
    const { user } = await getAuthenticatedUser(alertToken);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;
    const db = getAdminDb();
    const now = new Date();

    // Fetch user's notification sets
    const notificationSetsSnapshot = await db
      .collection('notificationSets')
      .where('userId', '==', userId)
      .get();

    // Fetch active sent notifications (not acknowledged, cleaning not ended)
    const sentNotificationsSnapshot = await db
      .collection('sentNotifications')
      .where('userId', '==', userId)
      .where('cleaningEnd', '>', Timestamp.fromDate(now))
      .get();

    const sentNotifications: (SentNotification & { id: string })[] =
      sentNotificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as SentNotification),
      }));

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

    // Get active alerts (unacknowledged sent notifications)
    const activeAlerts = sentNotifications.filter((sn) => !sn.acknowledged);

    return NextResponse.json({
      notificationSets,
      activeAlerts: activeAlerts.map((alert) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...alertData } = alert;
        return alertData;
      }),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
