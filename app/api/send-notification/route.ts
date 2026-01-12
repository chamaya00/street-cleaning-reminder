import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getAdminDb } from '@/lib/firebase-admin';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL;

if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

interface SendNotificationRequest {
  userId: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
  setId?: string;
}

export async function POST(request: Request) {
  try {
    // Verify VAPID is configured
    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      console.error('[PUSH] VAPID keys not configured');
      return NextResponse.json(
        { error: 'Push notifications not configured on server' },
        { status: 500 }
      );
    }

    const {
      userId,
      title = 'Street Cleaning Reminder',
      body = 'You have an upcoming street cleaning alert',
      url = '/',
      tag,
      urgent = false,
      setId,
    } = (await request.json()) as SendNotificationRequest;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscription = userData?.pushSubscription as PushSubscription | undefined;

    if (!subscription) {
      return NextResponse.json(
        { error: 'User has no push subscription' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      tag,
      urgent,
      setId,
    });

    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`[PUSH] Notification sent to user ${userId}: ${title}`);
      return NextResponse.json({ success: true });
    } catch (pushError) {
      const error = pushError as { statusCode?: number; message?: string };

      // Handle expired/invalid subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`[PUSH] Subscription expired for user ${userId}, removing`);
        await db.collection('users').doc(userId).update({
          pushSubscription: null,
          pushExpiredAt: new Date(),
        });
        return NextResponse.json(
          { error: 'Subscription expired', code: 'EXPIRED' },
          { status: 410 }
        );
      }

      console.error(`[PUSH] Failed to send notification:`, error.message);
      throw pushError;
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
