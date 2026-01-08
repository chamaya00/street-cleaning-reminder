'use client';

import { useState, useMemo } from 'react';
import type { NotificationSetWithStatus } from '@/lib/types';
import { categorizeNotificationSets } from '@/lib/notification-utils';
import { NotificationSetCard } from './NotificationSetCard';
import { ActiveAlertCard } from './ActiveAlertCard';

type TabType = 'active' | 'upcoming' | 'all';

interface NotificationTabsProps {
  notificationSets: NotificationSetWithStatus[];
  alertToken?: string;
  onDismiss?: (setId: string, cleaningDate: string) => Promise<void>;
  isPreview?: boolean;
}

export function NotificationTabs({
  notificationSets,
  alertToken,
  onDismiss,
  isPreview = false,
}: NotificationTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('active');

  // Categorize notifications
  const categorized = useMemo(
    () => categorizeNotificationSets(notificationSets),
    [notificationSets]
  );

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: categorized.active.length },
    { id: 'upcoming', label: 'Upcoming', count: categorized.upcoming.length },
    { id: 'all', label: 'All', count: categorized.all.length },
  ];

  // If no active alerts, default to "all" tab
  const effectiveTab =
    activeTab === 'active' && categorized.active.length === 0 ? 'all' : activeTab;

  const renderContent = () => {
    switch (effectiveTab) {
      case 'active':
        if (categorized.active.length === 0) {
          return (
            <EmptyState
              icon={
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="No active alerts"
              description="You're all set! No street cleaning alerts right now."
            />
          );
        }
        return (
          <div className="space-y-4">
            {categorized.active.map((set) => (
              <ActiveAlertCard
                key={set.id}
                notificationSet={set}
                alertToken={alertToken}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        );

      case 'upcoming':
        if (categorized.upcoming.length === 0) {
          return (
            <EmptyState
              icon={
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="No upcoming reminders"
              description="No reminders scheduled for the next 48 hours."
            />
          );
        }
        return (
          <div className="space-y-3">
            {categorized.upcoming.map((set) => (
              <NotificationSetCard
                key={set.id}
                notificationSet={set}
                alertToken={alertToken}
              />
            ))}
          </div>
        );

      case 'all':
        if (categorized.all.length === 0) {
          return (
            <EmptyState
              icon={
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
              }
              title="No notification schedules"
              description="Select blocks on the map to receive street cleaning reminders."
              action={{
                label: 'Select Blocks',
                href: '/',
              }}
            />
          );
        }
        return (
          <div className="space-y-3">
            {categorized.all.map((set) => (
              <NotificationSetCard
                key={set.id}
                notificationSet={set}
                alertToken={alertToken}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className={isPreview ? 'opacity-60 pointer-events-none' : ''}>
      {/* Tab buttons */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              effectiveTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full ${
                  tab.id === 'active' && tab.count > 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {renderContent()}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {description}
      </p>
      {action && (
        <a
          href={action.href}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
