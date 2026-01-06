import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DismissRequest, DismissResponse, SentNotification } from '@/lib/types';

/**
 * POST /api/notifications/dismiss
 * Marks all notifications for a given notification set and cleaning date as acknowledged.
 * This prevents further reminders for that cleaning window.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<DismissResponse | { error: string }>> {
  try {
    // Support both session and token-based auth
    const alertToken = request.nextUrl.searchParams.get('t') ?? undefined;
    const { user } = await getAuthenticatedUser(alertToken);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;
    const body = (await request.json()) as DismissRequest;
    const { notificationSetId, cleaningDate } = body;

    if (!notificationSetId || !cleaningDate) {
      return NextResponse.json(
        { error: 'notificationSetId and cleaningDate are required' },
        { status: 400 }
      );
    }

    // Validate date format (ISO date string: YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(cleaningDate)) {
      return NextResponse.json(
        { error: 'cleaningDate must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // Verify the notification set belongs to this user
    const setDoc = await db.collection('notificationSets').doc(notificationSetId).get();
    if (!setDoc.exists) {
      return NextResponse.json(
        { error: 'Notification set not found' },
        { status: 404 }
      );
    }

    const setData = setDoc.data();
    if (setData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Find all sent notifications for this set and cleaning date
    const cleaningDateStart = new Date(cleaningDate + 'T00:00:00');
    const cleaningDateEnd = new Date(cleaningDate + 'T23:59:59');

    const sentNotificationsSnapshot = await db
      .collection('sentNotifications')
      .where('userId', '==', userId)
      .where('notificationSetId', '==', notificationSetId)
      .where('cleaningDate', '>=', Timestamp.fromDate(cleaningDateStart))
      .where('cleaningDate', '<=', Timestamp.fromDate(cleaningDateEnd))
      .get();

    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    // Mark all matching notifications as acknowledged
    for (const doc of sentNotificationsSnapshot.docs) {
      const data = doc.data() as SentNotification;
      if (!data.acknowledged) {
        batch.update(doc.ref, {
          acknowledged: true,
          acknowledgedAt: now,
        });
      }
    }

    // If no existing sent notifications, create an acknowledged placeholder
    // This prevents future notifications for this cleaning window
    if (sentNotificationsSnapshot.empty) {
      const setData = setDoc.data();
      const schedule = setData?.schedule;

      // Parse the cleaning time from schedule
      const startTime = schedule?.startTime ?? '08:00';
      const endTime = schedule?.endTime ?? '10:00';

      const cleaningStart = new Date(`${cleaningDate}T${startTime}:00`);
      const cleaningEnd = new Date(`${cleaningDate}T${endTime}:00`);

      const placeholderRef = db.collection('sentNotifications').doc();
      batch.set(placeholderRef, {
        userId,
        notificationSetId,
        notificationSetKey: setData?.setKey ?? '',
        streetName: setData?.streetName ?? '',
        blocksSummary: setData?.blocksSummary ?? '',
        cleaningDate: Timestamp.fromDate(cleaningDateStart),
        cleaningStart: Timestamp.fromDate(cleaningStart),
        cleaningEnd: Timestamp.fromDate(cleaningEnd),
        stage: 'night_before', // Placeholder stage
        sentAt: now,
        acknowledged: true,
        acknowledgedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    );
  }
}
