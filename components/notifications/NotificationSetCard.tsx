'use client';

import Link from 'next/link';
import type { NotificationSetWithStatus } from '@/lib/types';
import { formatSchedule } from '@/lib/utils';
import {
  formatDateTimeForDisplay,
  getRelativeTimeDescription,
  getStageLabel,
} from '@/lib/notification-utils';

interface NotificationSetCardProps {
  notificationSet: NotificationSetWithStatus;
  alertToken?: string;
}

export function NotificationSetCard({
  notificationSet,
  alertToken,
}: NotificationSetCardProps) {
  const { id, streetName, blocksSummary, schedule, nextReminderAt, nextReminderStage } =
    notificationSet;

  // Build the link with optional alert token
  const detailUrl = alertToken
    ? `/notifications/${id}?t=${alertToken}`
    : `/notifications/${id}`;

  return (
    <Link
      href={detailUrl}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Street name and blocks */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {streetName}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {blocksSummary}
          </p>

          {/* Schedule */}
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {formatSchedule(schedule)}
          </p>

          {/* Next reminder */}
          {nextReminderAt && nextReminderStage && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                Next: {getRelativeTimeDescription(nextReminderAt)} at{' '}
                {formatDateTimeForDisplay(nextReminderAt).split(', ').pop()}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({getStageLabel(nextReminderStage)})
              </span>
            </div>
          )}
        </div>

        {/* Arrow indicator */}
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
