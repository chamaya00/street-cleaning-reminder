import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { MapPageClient } from '@/components/map/MapPageClient';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

export default async function MapPage() {
  // Check if user is authenticated
  const { user } = await getSessionUser();

  if (!user) {
    redirect('/');
  }

  return <MapPageClient userPhone={user.phone} />;
}
