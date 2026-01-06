'use client';

import { useState, useCallback, FormEvent, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { NotificationSetWithStatus } from '@/lib/types';
import { NotificationTabs } from './NotificationTabs';

// Helper to check sessionStorage for pending blocks
function subscribeToPendingBlocks(_callback: () => void) {
  // sessionStorage doesn't have events, but we only need to check once on mount
  return () => {};
}

function getPendingBlocksSnapshot() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('pendingBlockIds') !== null;
}

function getServerSnapshot() {
  return false;
}

interface NotificationsPageClientProps {
  isAuthenticated: boolean;
  userPhone?: string;
  alertToken?: string;
  initialNotificationSets?: NotificationSetWithStatus[];
}

type VerificationStep = 'phone' | 'code';

interface FormState {
  phone: string;
  code: string;
  isLoading: boolean;
  error: string | null;
  step: VerificationStep;
}

export function NotificationsPageClient({
  isAuthenticated,
  userPhone,
  alertToken,
  initialNotificationSets = [],
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [notificationSets, setNotificationSets] = useState<NotificationSetWithStatus[]>(
    initialNotificationSets
  );
  const [formState, setFormState] = useState<FormState>({
    phone: '',
    code: '',
    isLoading: false,
    error: null,
    step: 'phone',
  });

  // Check for pending block selections from homepage
  const hasPendingBlocks = useSyncExternalStore(
    subscribeToPendingBlocks,
    getPendingBlocksSnapshot,
    getServerSnapshot
  );

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

  const formatPhoneForDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneForDisplay(e.target.value);
    setFormState((prev) => ({ ...prev, phone: formatted, error: null }));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormState((prev) => ({ ...prev, code: value, error: null }));
  };

  const handleSendCode = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const digits = formState.phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        setFormState((prev) => ({
          ...prev,
          error: 'Please enter a valid 10-digit phone number',
        }));
        return;
      }

      setFormState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/auth/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digits }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setFormState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.message || 'Failed to send verification code',
          }));
          return;
        }

        setFormState((prev) => ({
          ...prev,
          isLoading: false,
          step: 'code',
        }));
      } catch {
        setFormState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Network error. Please check your connection and try again.',
        }));
      }
    },
    [formState.phone]
  );

  const handleVerifyCode = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (formState.code.length !== 6) {
        setFormState((prev) => ({
          ...prev,
          error: 'Please enter the 6-digit code',
        }));
        return;
      }

      setFormState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const digits = formState.phone.replace(/\D/g, '');
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digits, code: formState.code }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setFormState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.message || 'Verification failed',
          }));
          return;
        }

        // Check if there are pending block selections
        const pendingBlocks = sessionStorage.getItem('pendingBlockIds');
        if (pendingBlocks) {
          // Save the pending blocks
          try {
            const blockIds = JSON.parse(pendingBlocks);
            await fetch('/api/subscriptions', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ blockIds }),
            });
            sessionStorage.removeItem('pendingBlockIds');
          } catch (err) {
            console.error('Error saving pending blocks:', err);
          }
        }

        // Refresh the page to show the authenticated notifications view
        router.refresh();
      } catch {
        setFormState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Network error. Please check your connection and try again.',
        }));
      }
    },
    [formState.phone, formState.code, router]
  );

  const handleBack = () => {
    setFormState((prev) => ({ ...prev, step: 'phone', code: '', error: null }));
  };

  const handleResendCode = async () => {
    setFormState((prev) => ({ ...prev, code: '', error: null }));
    const fakeEvent = { preventDefault: () => {} } as FormEvent;
    await handleSendCode(fakeEvent);
  };

  // Authenticated view
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                My Notifications
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Signed in as {userPhone}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit Blocks
              </Link>
              <a
                href="/api/auth/logout"
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Sign Out
              </a>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-6">
          <NotificationTabs
            notificationSets={notificationSets}
            alertToken={alertToken}
            onDismiss={handleDismiss}
          />
        </main>
      </div>
    );
  }

  // Unauthenticated view - phone verification
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            SF Street Cleaning Reminder
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {hasPendingBlocks ? 'Save Your Selections' : 'Sign In'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {hasPendingBlocks
                  ? 'Enter your phone number to save your block selections and receive notifications'
                  : 'Enter your phone number to manage your notifications'}
              </p>
            </div>

            {formState.step === 'phone' ? (
              <form onSubmit={handleSendCode} className="flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formState.phone}
                    onChange={handlePhoneChange}
                    placeholder="(415) 555-1234"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    disabled={formState.isLoading}
                    autoComplete="tel"
                  />
                </div>

                {formState.error && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {formState.error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={formState.isLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none"
                >
                  {formState.isLoading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <div className="text-center mb-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We sent a code to{' '}
                    <span className="font-medium">{formState.phone}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Change number
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="code"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="code"
                    value={formState.code}
                    onChange={handleCodeChange}
                    placeholder="123456"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-center text-2xl tracking-widest"
                    disabled={formState.isLoading}
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                </div>

                {formState.error && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {formState.error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={formState.isLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none"
                >
                  {formState.isLoading ? 'Verifying...' : 'Verify Code'}
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={formState.isLoading}
                  className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Didn&apos;t receive the code? Resend
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/"
                className="block text-center text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                &larr; Back to map
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
