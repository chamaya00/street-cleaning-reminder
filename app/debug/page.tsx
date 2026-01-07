import { getAdminDb } from '@/lib/firebase-admin';
import { DebugDataDisplay } from '@/components/debug/DebugDataDisplay';

export const dynamic = 'force-dynamic';

interface FirestoreSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

interface StreetSegmentDoc {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  geometry: string;
  schedules: FirestoreSchedule[];
  syncVersion: string;
}

async function getStreetSegments() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('streetSegments').limit(100).get();

    const segments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      count: snapshot.size,
      segments: segments as (StreetSegmentDoc & { id: string })[],
    };
  } catch (error) {
    console.error('Error fetching street segments:', error);
    return {
      count: 0,
      segments: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function DebugPage() {
  const data = await getStreetSegments();
  return <DebugDataDisplay data={data} />;
}
