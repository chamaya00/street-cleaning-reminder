import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminDb } from '@/lib/firebase-admin';

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

export async function POST(request: Request) {
  try {
    const { subscription } = (await request.json()) as {
      subscription: PushSubscriptionJSON;
    };

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Missing or invalid subscription' },
        { status: 400 }
      );
    }

    // Get user ID from session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = sessionCookie.value;
    const db = getAdminDb();

    // Verify user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Store push subscription for user
    await db.collection('users').doc(userId).update({
      pushSubscription: subscription,
      pushEnabledAt: new Date(),
    });

    console.log(`[PUSH] Subscription saved for user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove push subscription
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = sessionCookie.value;
    const db = getAdminDb();

    await db.collection('users').doc(userId).update({
      pushSubscription: null,
      pushDisabledAt: new Date(),
    });

    console.log(`[PUSH] Subscription removed for user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}
