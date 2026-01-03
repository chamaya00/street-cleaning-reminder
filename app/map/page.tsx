import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function MapPage() {
  // Check if user is authenticated
  const { user } = await getSessionUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Select Your Blocks
          </h1>
          <p className="max-w-md text-gray-600 dark:text-gray-300">
            Welcome! You&apos;re logged in as <span className="font-medium">{user.phone}</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-300">
            Map UI will be implemented in Phase 3
          </p>
          <div className="flex gap-4">
            <a
              href="/notifications"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              View Notifications
            </a>
            <a
              href="/api/auth/logout"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Sign Out
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
