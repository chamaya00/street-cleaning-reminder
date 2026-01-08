'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { NotificationSetWithStatus } from '@/lib/types';
import { NotificationTabs } from './NotificationTabs';
import { Header } from '@/components/layout/Header';

interface NotificationsPageClientProps {
  isAuthenticated: boolean;
  userPhone?: string;
  alertToken?: string;
  initialNotificationSets?: NotificationSetWithStatus[];
  previewNotificationSets?: NotificationSetWithStatus[];
  pendingBlocks?: string;
}

export function NotificationsPageClient({
  isAuthenticated,
  userPhone,
  alertToken,
  initialNotificationSets = [],
  previewNotificationSets = [],
  pendingBlocks,
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [notificationSets, setNotificationSets] = useState<NotificationSetWithStatus[]>(
    initialNotificationSets
  );

  const hasPendingBlocks = !!pendingBlocks && previewNotificationSets.length > 0;

  // Handle dismiss functionality
  const handleDismiss = useCallback(
    async (setId: string, cleaningDate: string) => {
      const url = alertToken
        ? `/api/notifications/dismiss?t=${alertToken}`
        : '/api/notifications/dismiss';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationSetId: setId, cleaningDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      // Update local state to remove the dismissed alert
      setNotificationSets((prev) =>
        prev.map((set) =>
          set.id === setId ? { ...set, isActive: false } : set
        )
      );
    },
    [alertToken]
  );

  // Handle save button click for unauthenticated users
  const handleSave = () => {
    const loginUrl = pendingBlocks
      ? `/login?redirect=/notifications&blocks=${pendingBlocks}`
      : '/login?redirect=/notifications';
    router.push(loginUrl);
  };

  // Authenticated view
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header isAuthenticated={true} userPhone={userPhone} />

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-6 w-full">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            My Notifications
          </h1>
          <NotificationTabs
            notificationSets={notificationSets}
            alertToken={alertToken}
            onDismiss={handleDismiss}
          />
        </main>
      </div>
    );
  }

  // Unauthenticated view with preview
  if (hasPendingBlocks) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header isAuthenticated={false} />

        {/* Preview banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Preview - Sign in to save your selections
              </span>
            </div>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
            >
              Save Selections
            </button>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-6 w-full">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Notification Preview
          </h1>
          <NotificationTabs
            notificationSets={previewNotificationSets}
            isPreview={true}
          />

          {/* Back to map link */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              &larr; Back to map to modify selections
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Unauthenticated view without pending blocks - prompt to select blocks or sign in
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header isAuthenticated={false} />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 mb-4">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Get Street Cleaning Reminders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Select blocks on the map to receive notifications before street cleaning starts.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Select Blocks on Map
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
