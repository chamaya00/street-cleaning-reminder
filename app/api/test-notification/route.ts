import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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
}

// GET endpoint for easy testing - visit in browser or use curl
export async function GET() {
  try {
    // Verify VAPID is configured
    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      return NextResponse.json(
        {
          error: 'VAPID keys not configured',
          hint: 'Add NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL to .env.local',
        },
        { status: 500 }
      );
    }

    // Get user from session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          error: 'Not authenticated',
          hint: 'Log in first, then visit this page',
        },
        { status: 401 }
      );
    }

    const userId = sessionCookie.value;
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscription = userData?.pushSubscription as PushSubscription | undefined;

    if (!subscription) {
      return NextResponse.json(
        {
          error: 'No push subscription found',
          hint: 'Enable push notifications first using the toggle in the app',
          userId,
        },
        { status: 400 }
      );
    }

    // Send test notification
    const payload = JSON.stringify({
      title: '🚗 Street Cleaning Test',
      body: 'This is a test notification - your push notifications are working!',
      url: '/',
      urgent: true,
    });

    try {
      await webpush.sendNotification(subscription, payload);
      return NextResponse.json({
        success: true,
        message: 'Test notification sent! Check your device.',
        userId,
      });
    } catch (pushError) {
      const error = pushError as { statusCode?: number; message?: string };

      if (error.statusCode === 410 || error.statusCode === 404) {
        // Clean up expired subscription
        await db.collection('users').doc(userId).update({
          pushSubscription: null,
          pushExpiredAt: new Date(),
        });
        return NextResponse.json(
          {
            error: 'Subscription expired',
            hint: 'Re-enable push notifications in the app',
          },
          { status: 410 }
        );
      }

      throw pushError;
    }
  } catch (error) {
    console.error('Test notification failed:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification', details: String(error) },
      { status: 500 }
    );
  }
}
