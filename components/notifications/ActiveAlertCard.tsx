'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { NotificationSetWithStatus } from '@/lib/types';
import { formatSchedule } from '@/lib/utils';
import {
  formatTimeForDisplay,
  getRelativeTimeDescription,
  getStageLabel,
  getDateStringInPacific,
  findNextCleaningDate,
  createPacificDate,
} from '@/lib/notification-utils';

interface ActiveAlertCardProps {
  notificationSet: NotificationSetWithStatus;
  alertToken?: string;
  onDismiss?: (setId: string, cleaningDate: string) => Promise<void>;
}

export function ActiveAlertCard({
  notificationSet,
  alertToken,
  onDismiss,
}: ActiveAlertCardProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const {
    id,
    streetName,
    blocksSummary,
    schedule,
    nextReminderAt,
    nextReminderStage,
  } = notificationSet;

  // Calculate cleaning window
  const now = new Date();
  const nextCleaning = findNextCleaningDate(schedule, now);
  const cleaningDateStr = getDateStringInPacific(nextCleaning);
  const cleaningStart = nextCleaning;
  const cleaningEnd = createPacificDate(cleaningDateStr, schedule.endTime);

  // Build the link with optional alert token
  const detailUrl = alertToken
    ? `/notifications/${id}?t=${alertToken}`
    : `/notifications/${id}`;

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDismissing || !onDismiss) return;

    setIsDismissing(true);
    try {
      await onDismiss(id, cleaningDateStr);
    } catch (error) {
      console.error('Failed to dismiss:', error);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800 overflow-hidden">
      <Link
        href={detailUrl}
        className="block p-4 hover:bg-red-100/50 dark:hover:bg-red-900/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Active indicator */}
          <div className="flex-shrink-0 mt-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Street name and blocks */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {streetName}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {blocksSummary}
            </p>

            {/* Cleaning time */}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {getRelativeTimeDescription(cleaningStart)} {formatTimeForDisplay(cleaningStart)}-
                {formatTimeForDisplay(cleaningEnd)}
              </span>
            </div>

            {/* Schedule info */}
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {formatSchedule(schedule)}
            </p>

            {/* Next reminder info */}
            {nextReminderAt && nextReminderStage && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Next reminder: {getStageLabel(nextReminderStage)}
              </p>
            )}
          </div>

          {/* Arrow indicator */}
          <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 mt-2">
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

      {/* Dismiss button */}
      {onDismiss && (
        <div className="px-4 pb-4">
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            className="w-full py-2 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDismissing ? 'Dismissing...' : 'Dismiss Alert'}
          </button>
        </div>
      )}
    </div>
  );
}
