export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            SF Street Cleaning Reminder
          </h1>
          <p className="max-w-md text-lg text-gray-600 dark:text-gray-300">
            Never get a parking ticket again. Get SMS reminders before street
            cleaning in San Francisco&apos;s Marina district.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Phase 1 Complete - Project Setup
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            Authentication and Map UI coming in Phase 2 &amp; 3
          </p>
        </div>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>Features coming soon:</p>
          <ul className="mt-2 list-inside list-disc text-left">
            <li>Phone number verification</li>
            <li>Interactive map to select blocks</li>
            <li>SMS reminders at customizable times</li>
            <li>Notification management dashboard</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
