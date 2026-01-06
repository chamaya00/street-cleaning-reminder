import type {
  CleaningSchedule,
  NotificationSetWithStatus,
  NotificationStage,
  SentNotification,
} from './types';

// Los Angeles timezone for SF
const TIMEZONE = 'America/Los_Angeles';

/**
 * Get the day of week for a date in Pacific time
 */
export function getDayOfWeekInPacific(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  });
  const dayStr = formatter.format(date);
  const days: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return days[dayStr] ?? 0;
}

/**
 * Get the date string (YYYY-MM-DD) for a date in Pacific time
 */
export function getDateStringInPacific(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Get time components (hours, minutes) in Pacific time
 */
export function getTimeInPacific(date: Date): { hours: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return { hours, minutes };
}

/**
 * Parse time string (HH:MM) to hours and minutes
 */
export function parseTimeString(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Get week of month (1-4) for a date in Pacific time
 */
export function getWeekOfMonthInPacific(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    day: 'numeric',
  });
  const dayOfMonth = parseInt(formatter.format(date), 10);
  return Math.ceil(dayOfMonth / 7);
}

/**
 * Check if a cleaning schedule applies to a given date
 */
export function scheduleAppliesToDate(schedule: CleaningSchedule, date: Date): boolean {
  const dayOfWeek = getDayOfWeekInPacific(date);
  if (schedule.dayOfWeek !== dayOfWeek) {
    return false;
  }

  const weekOfMonth = getWeekOfMonthInPacific(date);

  switch (schedule.frequency) {
    case 'weekly':
      return true;
    case '1st':
      return weekOfMonth === 1;
    case '2nd':
      return weekOfMonth === 2;
    case '3rd':
      return weekOfMonth === 3;
    case '4th':
      return weekOfMonth === 4;
    case '1st_3rd':
      return weekOfMonth === 1 || weekOfMonth === 3;
    case '2nd_4th':
      return weekOfMonth === 2 || weekOfMonth === 4;
    default:
      return false;
  }
}

/**
 * Create a Date object for a specific time on a specific date in Pacific time
 */
export function createPacificDate(dateStr: string, timeStr: string): Date {
  // Parse the date and time
  const [year, month, day] = dateStr.split('-').map(Number);
  const { hours, minutes } = parseTimeString(timeStr);

  // Create a date string that can be parsed as Pacific time
  // Using the full date string with the time zone
  const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Get offset for Pacific time at this date
  const tempDate = new Date(dateTimeStr + 'Z');
  const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Get parts to calculate offset
  const parts = pacificFormatter.formatToParts(tempDate);
  const pHours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const diffHours = pHours - tempDate.getUTCHours();
  const offsetMs = diffHours * 60 * 60 * 1000;

  // Create the actual date by subtracting the offset
  return new Date(tempDate.getTime() - offsetMs);
}

/**
 * Find the next occurrence of a cleaning schedule after a given date
 */
export function findNextCleaningDate(schedule: CleaningSchedule, afterDate: Date): Date {
  const maxDaysToCheck = 35; // Max days in a month + week buffer
  let checkDate = new Date(afterDate);

  for (let i = 0; i < maxDaysToCheck; i++) {
    if (scheduleAppliesToDate(schedule, checkDate)) {
      // Get the cleaning start time on this date
      const dateStr = getDateStringInPacific(checkDate);
      const cleaningStart = createPacificDate(dateStr, schedule.startTime);

      // Only return if the cleaning hasn't ended yet
      const cleaningEnd = createPacificDate(dateStr, schedule.endTime);
      if (cleaningEnd > afterDate) {
        return cleaningStart;
      }
    }

    // Move to next day
    checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // Fallback: shouldn't happen for valid schedules
  return new Date(afterDate.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Calculate the send time for a notification stage
 */
export function getStageSendTime(cleaningStart: Date, stage: NotificationStage): Date {
  switch (stage) {
    case 'night_before': {
      // 8pm the night before
      const dateStr = getDateStringInPacific(cleaningStart);
      const [year, month, day] = dateStr.split('-').map(Number);
      const prevDay = new Date(year, month - 1, day - 1);
      const prevDateStr = getDateStringInPacific(prevDay);
      return createPacificDate(prevDateStr, '20:00');
    }
    case '1hr':
      return new Date(cleaningStart.getTime() - 60 * 60 * 1000);
    case '30min':
      return new Date(cleaningStart.getTime() - 30 * 60 * 1000);
    case '10min':
      return new Date(cleaningStart.getTime() - 10 * 60 * 1000);
    default:
      return cleaningStart;
  }
}

/**
 * Determine which notification stage is currently "due" based on current time and cleaning start
 * Returns null if no stage is due or cleaning has already started
 */
export function getStageDueNow(
  cleaningStart: Date,
  now: Date = new Date()
): NotificationStage | null {
  const stages: NotificationStage[] = ['night_before', '1hr', '30min', '10min'];

  // If cleaning has already started, no stage is due
  if (now >= cleaningStart) {
    return null;
  }

  // Check each stage in reverse order (most urgent first)
  for (let i = stages.length - 1; i >= 0; i--) {
    const stage = stages[i];
    const sendTime = getStageSendTime(cleaningStart, stage);
    const nextStageTime =
      i < stages.length - 1 ? getStageSendTime(cleaningStart, stages[i + 1]) : cleaningStart;

    if (now >= sendTime && now < nextStageTime) {
      return stage;
    }
  }

  return null;
}

/**
 * Compute the next reminder time and stage for a notification set
 */
export function computeNextReminder(
  schedule: CleaningSchedule,
  sentNotifications: SentNotification[],
  now: Date = new Date()
): { nextReminderAt: Date | null; nextReminderStage: NotificationStage | null } {
  const stages: NotificationStage[] = ['night_before', '1hr', '30min', '10min'];

  // Find the next cleaning occurrence
  const nextCleaningStart = findNextCleaningDate(schedule, now);
  const cleaningDateStr = getDateStringInPacific(nextCleaningStart);

  // Check if this cleaning window has been acknowledged
  const acknowledged = sentNotifications.some(
    (sn) =>
      getDateStringInPacific(sn.cleaningDate.toDate()) === cleaningDateStr && sn.acknowledged
  );

  if (acknowledged) {
    // Find the next cleaning after this one
    const nextDayAfterCleaning = new Date(nextCleaningStart.getTime() + 24 * 60 * 60 * 1000);
    const followingCleaning = findNextCleaningDate(schedule, nextDayAfterCleaning);
    const followingDateStr = getDateStringInPacific(followingCleaning);

    // Check if that one is also acknowledged
    const followingAcknowledged = sentNotifications.some(
      (sn) =>
        getDateStringInPacific(sn.cleaningDate.toDate()) === followingDateStr && sn.acknowledged
    );

    if (followingAcknowledged) {
      return { nextReminderAt: null, nextReminderStage: null };
    }

    // Find the next unsent stage for the following cleaning
    for (const stage of stages) {
      const sendTime = getStageSendTime(followingCleaning, stage);
      if (sendTime > now) {
        return { nextReminderAt: sendTime, nextReminderStage: stage };
      }
    }

    return { nextReminderAt: null, nextReminderStage: null };
  }

  // Find the next unsent stage for this cleaning
  const sentStagesForThisCleaning = new Set(
    sentNotifications
      .filter((sn) => getDateStringInPacific(sn.cleaningDate.toDate()) === cleaningDateStr)
      .map((sn) => sn.stage)
  );

  for (const stage of stages) {
    if (sentStagesForThisCleaning.has(stage)) {
      continue;
    }

    const sendTime = getStageSendTime(nextCleaningStart, stage);
    if (sendTime > now) {
      return { nextReminderAt: sendTime, nextReminderStage: stage };
    }
  }

  // All stages for this cleaning have passed, look at next occurrence
  const nextDayAfterCleaning = new Date(nextCleaningStart.getTime() + 24 * 60 * 60 * 1000);
  const followingCleaning = findNextCleaningDate(schedule, nextDayAfterCleaning);
  const nightBeforeTime = getStageSendTime(followingCleaning, 'night_before');

  return {
    nextReminderAt: nightBeforeTime,
    nextReminderStage: 'night_before',
  };
}

export interface CategorizedNotifications {
  active: NotificationSetWithStatus[];
  upcoming: NotificationSetWithStatus[];
  all: NotificationSetWithStatus[];
}

/**
 * Categorize notification sets into Active, Upcoming, and All tabs
 *
 * - Active: cleaning in progress or imminent (within 2 hours), not acknowledged
 * - Upcoming: next reminder within 48 hours, not yet active
 * - All: every notification set
 */
export function categorizeNotificationSets(
  notificationSets: NotificationSetWithStatus[],
  now: Date = new Date()
): CategorizedNotifications {
  const active: NotificationSetWithStatus[] = [];
  const upcoming: NotificationSetWithStatus[] = [];

  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  for (const set of notificationSets) {
    if (set.isActive) {
      active.push(set);
    } else if (set.nextReminderAt && set.nextReminderAt <= fortyEightHoursFromNow) {
      // Check if this is "about to become active" (within 2 hours)
      const nextCleaning = findNextCleaningDate(set.schedule, now);
      if (nextCleaning <= twoHoursFromNow) {
        active.push(set);
      } else {
        upcoming.push(set);
      }
    }
  }

  // Sort active by next reminder time (soonest first)
  active.sort((a, b) => {
    if (!a.nextReminderAt) return 1;
    if (!b.nextReminderAt) return -1;
    return a.nextReminderAt.getTime() - b.nextReminderAt.getTime();
  });

  // Sort upcoming by next reminder time (soonest first)
  upcoming.sort((a, b) => {
    if (!a.nextReminderAt) return 1;
    if (!b.nextReminderAt) return -1;
    return a.nextReminderAt.getTime() - b.nextReminderAt.getTime();
  });

  // Sort all by street name
  const all = [...notificationSets].sort((a, b) =>
    a.streetName.localeCompare(b.streetName)
  );

  return { active, upcoming, all };
}

/**
 * Check if a notification set has an active (unacknowledged) alert
 */
export function hasActiveAlert(
  setId: string,
  sentNotifications: SentNotification[],
  now: Date = new Date()
): boolean {
  return sentNotifications.some((sn) => {
    if (sn.notificationSetId !== setId) return false;
    if (sn.acknowledged) return false;
    // Check if cleaning hasn't ended yet
    return sn.cleaningEnd.toDate() > now;
  });
}

/**
 * Format a date for display in Pacific time
 */
export function formatDateForDisplay(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return formatter.format(date);
}

/**
 * Format a time for display in Pacific time
 */
export function formatTimeForDisplay(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

/**
 * Format a date/time for display in Pacific time
 */
export function formatDateTimeForDisplay(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

/**
 * Get relative time description (e.g., "TODAY", "TOMORROW", "Mon, Jan 6")
 */
export function getRelativeTimeDescription(date: Date, now: Date = new Date()): string {
  const todayStr = getDateStringInPacific(now);
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = getDateStringInPacific(tomorrowDate);
  const dateStr = getDateStringInPacific(date);

  if (dateStr === todayStr) {
    return 'TODAY';
  } else if (dateStr === tomorrowStr) {
    return 'TOMORROW';
  } else {
    return formatDateForDisplay(date);
  }
}

/**
 * Get stage label for display
 */
export function getStageLabel(stage: NotificationStage): string {
  switch (stage) {
    case 'night_before':
      return '8pm night before';
    case '1hr':
      return '1 hour before';
    case '30min':
      return '30 minutes before';
    case '10min':
      return '10 minutes before';
    default:
      return stage;
  }
}
