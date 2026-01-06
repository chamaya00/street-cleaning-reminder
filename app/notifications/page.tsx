import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { NotificationsPageClient } from '@/components/notifications/NotificationsPageClient';
import { computeNextReminder, hasActiveAlert } from '@/lib/notification-utils';
import type {
  NotificationSet,
  NotificationSetWithStatus,
  SentNotification,
} from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

interface NotificationsPageProps {
  searchParams: Promise<{ t?: string }>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const alertToken = params.t;

  // Check if user is authenticated (session or token)
  const { user } = await getAuthenticatedUser(alertToken);

  if (!user) {
    // Return unauthenticated view
    return (
      <NotificationsPageClient
        isAuthenticated={false}
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
