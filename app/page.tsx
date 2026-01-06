import { getSessionUser } from '@/lib/auth';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { user } = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Header isAuthenticated={!!user} userPhone={user?.phone} />

      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-6">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              SF Street Cleaning Reminder
            </h1>
            <p className="max-w-md text-lg text-gray-600 dark:text-gray-300">
              Never get a parking ticket again. Get SMS reminders before street
              cleaning in San Francisco&apos;s Marina district.
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Get Started
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select your parking spots on the map to receive SMS reminders
            </p>
            <Link
              href="/map"
              className="w-full px-6 py-3 text-center font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </div>

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>How it works:</p>
            <ul className="mt-2 list-inside list-disc text-left">
              <li>Select your parking spots on the map</li>
              <li>Get reminders the night before and morning of</li>
              <li>Reply &quot;1&quot; to dismiss when you&apos;ve moved your car</li>
              <li>Never get a ticket again</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
