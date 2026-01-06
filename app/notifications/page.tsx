import { getSessionUser } from '@/lib/auth';
import { NotificationsPageClient } from '@/components/notifications/NotificationsPageClient';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  // Check if user is authenticated
  const { user } = await getSessionUser();

  return (
    <NotificationsPageClient
      isAuthenticated={!!user}
      userPhone={user?.phone}
    />
  );
}
