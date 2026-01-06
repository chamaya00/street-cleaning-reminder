import { redirect } from 'next/navigation';

// Redirect /map to the homepage which now has the map view
export default function MapPage() {
  redirect('/');
}
