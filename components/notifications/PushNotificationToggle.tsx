'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  registerServiceWorker,
  subscribeToPush,
  sendSubscriptionToServer,
  isPushSupported,
  getPushPermissionState,
  isSubscribedToPush,
} from '@/lib/push-notifications';

interface Props {
  userId: string;
}

type Status = 'loading' | 'unsupported' | 'prompt' | 'enabling' | 'enabled' | 'denied' | 'error';

export function PushNotificationToggle({ userId }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      if (!isPushSupported()) {
        setStatus('unsupported');
        return;
      }

      const permission = await getPushPermissionState();

      if (permission === 'denied') {
        setStatus('denied');
        return;
      }

      if (permission === 'granted') {
        // Check if we have an active subscription
        const subscribed = await isSubscribedToPush();
        setStatus(subscribed ? 'enabled' : 'prompt');
      } else {
        setStatus('prompt');
      }
    };

    checkStatus();
  }, []);

  const enableNotifications = useCallback(async () => {
    setStatus('enabling');
    setError(null);

    try {
      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error('Failed to register service worker');
      }

      // Subscribe to push
      const subscription = await subscribeToPush(registration);
      if (!subscription) {
        // User might have denied permission
        const permission = await getPushPermissionState();
        if (permission === 'denied') {
          setStatus('denied');
          return;
        }
        throw new Error('Failed to subscribe to push notifications');
      }

      // Send subscription to server
      const saved = await sendSubscriptionToServer(subscription, userId);
      if (!saved) {
        throw new Error('Failed to save subscription to server');
      }

      setStatus('enabled');
    } catch (err) {
      console.error('Failed to enable notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
      setStatus('error');
    }
  }, [userId]);

  const testNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/test-notification');
      const data = await response.json();

      if (!response.ok) {
        alert(`Test failed: ${data.error}\n${data.hint || ''}`);
      }
    } catch (err) {
      alert('Failed to send test notification');
      console.error(err);
    }
  }, []);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Checking notification support...</span>
        </div>
      </div>
    );
  }

  // Unsupported browser
  if (status === 'unsupported') {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">Push notifications not supported</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Try using Chrome, Firefox, or Edge. On iOS, add this app to your home screen first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Permission denied
  if (status === 'denied') {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Notifications blocked</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Please enable notifications in your browser settings, then refresh this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Enabled state
  if (status === 'enabled') {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-green-800 dark:text-green-200">Push notifications enabled</span>
          </div>
          <button
            onClick={testNotification}
            className="px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 rounded-md hover:bg-green-200 dark:hover:bg-green-900/60 transition"
          >
            Test
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">Failed to enable notifications</p>
            {error && <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>}
            <button
              onClick={enableNotifications}
              className="mt-2 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Prompt state (default)
  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <div className="flex-1">
          <p className="font-medium text-blue-800 dark:text-blue-200">Enable push notifications</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Get notified on your device when street cleaning is approaching.
          </p>
          <button
            onClick={enableNotifications}
            disabled={status === 'enabling'}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {status === 'enabling' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enabling...
              </span>
            ) : (
              'Enable Notifications'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
