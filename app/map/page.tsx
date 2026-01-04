import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { MapPageClient } from '@/components/map/MapPageClient';

export default async function MapPage() {
  // Check if user is authenticated
  const { user } = await getSessionUser();

  if (!user) {
    redirect('/');
  }

  return <MapPageClient userPhone={user.phone} />;
}
