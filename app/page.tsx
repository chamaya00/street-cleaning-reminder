import { getSessionUser } from '@/lib/auth';
import { HomeMapClient } from '@/components/map/HomeMapClient';
import { getAdminDb } from '@/lib/firebase-admin';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Check if user is authenticated
  const { user } = await getSessionUser();

  // If authenticated, load their saved subscriptions
  let savedBlockIds: string[] = [];
  if (user) {
    try {
      const db = getAdminDb();
      const subscriptionsSnapshot = await db
        .collection('subscriptions')
        .where('userId', '==', user.userId)
        .where('active', '==', true)
        .get();

      savedBlockIds = subscriptionsSnapshot.docs.map((doc) => doc.data().blockId);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  }

  return (
    <HomeMapClient
      isAuthenticated={!!user}
      userPhone={user?.phone}
      initialBlockIds={savedBlockIds}
    />
  );
}
