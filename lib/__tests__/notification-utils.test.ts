import { Timestamp } from 'firebase/firestore';
import {
  getDayOfWeekInPacific,
  getDateStringInPacific,
  getWeekOfMonthInPacific,
  scheduleAppliesToDate,
  parseTimeString,
  getStageSendTime,
  getStageDueNow,
  computeNextReminder,
  categorizeNotificationSets,
  hasActiveAlert,
  getRelativeTimeDescription,
  getStageLabel,
  formatDateForDisplay,
  formatTimeForDisplay,
} from '../notification-utils';
import type { CleaningSchedule, NotificationSetWithStatus, SentNotification } from '../types';

// Helper to create a mock Timestamp
function createMockTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toMillis: () => date.getTime(),
    isEqual: (other: Timestamp) => other.toMillis() === date.getTime(),
  } as Timestamp;
}

describe('notification-utils', () => {
  describe('parseTimeString', () => {
    it('parses time string correctly', () => {
      expect(parseTimeString('08:00')).toEqual({ hours: 8, minutes: 0 });
      expect(parseTimeString('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 });
    });
  });

  describe('getDayOfWeekInPacific', () => {
    it('returns correct day of week', () => {
      // Monday Jan 6, 2025 in Pacific time
      const monday = new Date('2025-01-06T12:00:00-08:00');
      expect(getDayOfWeekInPacific(monday)).toBe(1);

      // Sunday Jan 5, 2025 in Pacific time
      const sunday = new Date('2025-01-05T12:00:00-08:00');
      expect(getDayOfWeekInPacific(sunday)).toBe(0);

      // Saturday Jan 11, 2025 in Pacific time
      const saturday = new Date('2025-01-11T12:00:00-08:00');
      expect(getDayOfWeekInPacific(saturday)).toBe(6);
    });
  });

  describe('getDateStringInPacific', () => {
    it('returns date string in YYYY-MM-DD format', () => {
      const date = new Date('2025-01-06T12:00:00-08:00');
      expect(getDateStringInPacific(date)).toBe('2025-01-06');
    });

    it('handles timezone correctly', () => {
      // 11pm Pacific on Jan 6 is still Jan 6
      const latePacific = new Date('2025-01-07T07:00:00Z'); // 11pm Pacific on Jan 6
      expect(getDateStringInPacific(latePacific)).toBe('2025-01-06');
    });
  });

  describe('getWeekOfMonthInPacific', () => {
    it('returns correct week of month', () => {
      // Jan 1, 2025 is week 1
      const jan1 = new Date('2025-01-01T12:00:00-08:00');
      expect(getWeekOfMonthInPacific(jan1)).toBe(1);

      // Jan 7, 2025 is week 1
      const jan7 = new Date('2025-01-07T12:00:00-08:00');
      expect(getWeekOfMonthInPacific(jan7)).toBe(1);

      // Jan 8, 2025 is week 2
      const jan8 = new Date('2025-01-08T12:00:00-08:00');
      expect(getWeekOfMonthInPacific(jan8)).toBe(2);

      // Jan 15, 2025 is week 3
      const jan15 = new Date('2025-01-15T12:00:00-08:00');
      expect(getWeekOfMonthInPacific(jan15)).toBe(3);

      // Jan 22, 2025 is week 4
      const jan22 = new Date('2025-01-22T12:00:00-08:00');
      expect(getWeekOfMonthInPacific(jan22)).toBe(4);
    });
  });

  describe('scheduleAppliesToDate', () => {
    const weeklyTuesdaySchedule: CleaningSchedule = {
      dayOfWeek: 2, // Tuesday
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    const firstTuesdaySchedule: CleaningSchedule = {
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '10:00',
      frequency: '1st',
    };

    const firstThirdTuesdaySchedule: CleaningSchedule = {
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '10:00',
      frequency: '1st_3rd',
    };

    it('returns true for weekly schedule on matching day', () => {
      // Tuesday Jan 7, 2025
      const tuesday = new Date('2025-01-07T12:00:00-08:00');
      expect(scheduleAppliesToDate(weeklyTuesdaySchedule, tuesday)).toBe(true);
    });

    it('returns false for weekly schedule on non-matching day', () => {
      // Monday Jan 6, 2025
      const monday = new Date('2025-01-06T12:00:00-08:00');
      expect(scheduleAppliesToDate(weeklyTuesdaySchedule, monday)).toBe(false);
    });

    it('returns true for 1st week schedule on first occurrence', () => {
      // First Tuesday of Jan 2025 is Jan 7
      const firstTuesday = new Date('2025-01-07T12:00:00-08:00');
      expect(scheduleAppliesToDate(firstTuesdaySchedule, firstTuesday)).toBe(true);
    });

    it('returns false for 1st week schedule on later occurrence', () => {
      // Second Tuesday of Jan 2025 is Jan 14
      const secondTuesday = new Date('2025-01-14T12:00:00-08:00');
      expect(scheduleAppliesToDate(firstTuesdaySchedule, secondTuesday)).toBe(false);
    });

    it('returns true for 1st_3rd schedule on first and third occurrences', () => {
      // First Tuesday of Jan 2025 is Jan 7
      const firstTuesday = new Date('2025-01-07T12:00:00-08:00');
      expect(scheduleAppliesToDate(firstThirdTuesdaySchedule, firstTuesday)).toBe(true);

      // Third Tuesday of Jan 2025 is Jan 21
      const thirdTuesday = new Date('2025-01-21T12:00:00-08:00');
      expect(scheduleAppliesToDate(firstThirdTuesdaySchedule, thirdTuesday)).toBe(true);
    });

    it('returns false for 1st_3rd schedule on second and fourth occurrences', () => {
      // Second Tuesday of Jan 2025 is Jan 14
      const secondTuesday = new Date('2025-01-14T12:00:00-08:00');
      expect(scheduleAppliesToDate(firstThirdTuesdaySchedule, secondTuesday)).toBe(false);

      // Fourth Tuesday of Jan 2025 is Jan 28
      const fourthTuesday = new Date('2025-01-28T12:00:00-08:00');
      expect(scheduleAppliesToDate(firstThirdTuesdaySchedule, fourthTuesday)).toBe(false);
    });
  });

  describe('getStageSendTime', () => {
    it('returns 8pm night before for night_before stage', () => {
      // Cleaning at 8am on Jan 7, 2025
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const sendTime = getStageSendTime(cleaningStart, 'night_before');

      // Should be 8pm on Jan 6
      expect(sendTime.getUTCHours()).toBe(4); // 8pm Pacific = 4am UTC next day
    });

    it('returns 1 hour before for 1hr stage', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const sendTime = getStageSendTime(cleaningStart, '1hr');

      const diffMs = cleaningStart.getTime() - sendTime.getTime();
      expect(diffMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it('returns 30 minutes before for 30min stage', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const sendTime = getStageSendTime(cleaningStart, '30min');

      const diffMs = cleaningStart.getTime() - sendTime.getTime();
      expect(diffMs).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('returns 10 minutes before for 10min stage', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const sendTime = getStageSendTime(cleaningStart, '10min');

      const diffMs = cleaningStart.getTime() - sendTime.getTime();
      expect(diffMs).toBe(10 * 60 * 1000); // 10 minutes
    });
  });

  describe('getStageDueNow', () => {
    it('returns null when cleaning has started', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const now = new Date('2025-01-07T08:30:00-08:00'); // 30 min after start

      expect(getStageDueNow(cleaningStart, now)).toBe(null);
    });

    it('returns 10min when within 10 minutes of cleaning', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const now = new Date('2025-01-07T07:55:00-08:00'); // 5 min before

      expect(getStageDueNow(cleaningStart, now)).toBe('10min');
    });

    it('returns 30min when between 30 and 10 minutes before', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const now = new Date('2025-01-07T07:40:00-08:00'); // 20 min before

      expect(getStageDueNow(cleaningStart, now)).toBe('30min');
    });

    it('returns 1hr when between 60 and 30 minutes before', () => {
      const cleaningStart = new Date('2025-01-07T08:00:00-08:00');
      const now = new Date('2025-01-07T07:15:00-08:00'); // 45 min before

      expect(getStageDueNow(cleaningStart, now)).toBe('1hr');
    });
  });

  describe('computeNextReminder', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 2, // Tuesday
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    it('returns next reminder for schedule with no sent notifications', () => {
      // Sunday Jan 5, 2025 at noon - well before the 8pm night_before reminder on Monday
      const now = new Date('2025-01-05T12:00:00-08:00');
      const result = computeNextReminder(schedule, [], now);

      expect(result.nextReminderStage).toBe('night_before');
      expect(result.nextReminderAt).not.toBeNull();
    });

    it('skips night_before if past 8pm and returns 1hr stage', () => {
      // Monday Jan 6, 2025 at 9pm - after the 8pm night_before reminder
      const now = new Date('2025-01-06T21:00:00-08:00');
      const result = computeNextReminder(schedule, [], now);

      // night_before at 8pm has passed, so next is 1hr (7am on Tuesday)
      expect(result.nextReminderStage).toBe('1hr');
      expect(result.nextReminderAt).not.toBeNull();
    });

    it('returns null when all reminders for next cleaning are acknowledged', () => {
      // Tuesday morning before cleaning
      const now = new Date('2025-01-07T06:00:00-08:00');

      const acknowledgedNotification: SentNotification = {
        userId: 'user1',
        notificationSetId: 'set1',
        notificationSetKey: 'key1',
        streetName: 'Test St',
        blocksSummary: '100 (N side)',
        cleaningDate: createMockTimestamp(new Date('2025-01-07T00:00:00-08:00')),
        cleaningStart: createMockTimestamp(new Date('2025-01-07T08:00:00-08:00')),
        cleaningEnd: createMockTimestamp(new Date('2025-01-07T10:00:00-08:00')),
        stage: 'night_before',
        sentAt: createMockTimestamp(new Date('2025-01-06T20:00:00-08:00')),
        acknowledged: true,
        acknowledgedAt: createMockTimestamp(new Date('2025-01-06T21:00:00-08:00')),
      };

      const result = computeNextReminder(schedule, [acknowledgedNotification], now);

      // Should skip to next week's cleaning
      expect(result.nextReminderStage).toBe('night_before');
    });
  });

  describe('categorizeNotificationSets', () => {
    const createMockSet = (
      id: string,
      isActive: boolean,
      nextReminderAt: Date | null
    ): NotificationSetWithStatus => ({
      id,
      userId: 'user1',
      setKey: `key-${id}`,
      streetName: 'Test St',
      schedule: {
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '10:00',
        frequency: 'weekly',
      },
      blocks: [{ blockId: 'block1', blockNumber: 100, side: 'N' }],
      blocksSummary: '100 (N side)',
      isActive,
      nextReminderAt,
      nextReminderStage: nextReminderAt ? 'night_before' : null,
      createdAt: createMockTimestamp(new Date()),
      updatedAt: createMockTimestamp(new Date()),
    });

    it('categorizes active sets correctly', () => {
      const now = new Date('2025-01-06T12:00:00-08:00');
      const activeSet = createMockSet('set1', true, new Date('2025-01-07T07:00:00-08:00'));
      const inactiveSet = createMockSet('set2', false, new Date('2025-01-10T20:00:00-08:00'));

      const result = categorizeNotificationSets([activeSet, inactiveSet], now);

      expect(result.active).toHaveLength(1);
      expect(result.active[0].id).toBe('set1');
    });

    it('categorizes upcoming sets correctly', () => {
      const now = new Date('2025-01-06T12:00:00-08:00');
      // Upcoming: within 48 hours
      const upcomingSet = createMockSet('set1', false, new Date('2025-01-07T20:00:00-08:00'));
      // Not upcoming: more than 48 hours away
      const laterSet = createMockSet('set2', false, new Date('2025-01-10T20:00:00-08:00'));

      const result = categorizeNotificationSets([upcomingSet, laterSet], now);

      expect(result.upcoming).toHaveLength(1);
      expect(result.upcoming[0].id).toBe('set1');
    });

    it('includes all sets in the all category', () => {
      const now = new Date('2025-01-06T12:00:00-08:00');
      const set1 = createMockSet('set1', true, new Date('2025-01-07T07:00:00-08:00'));
      const set2 = createMockSet('set2', false, new Date('2025-01-10T20:00:00-08:00'));

      const result = categorizeNotificationSets([set1, set2], now);

      expect(result.all).toHaveLength(2);
    });
  });

  describe('hasActiveAlert', () => {
    it('returns true when there is an unacknowledged notification for the set', () => {
      const now = new Date('2025-01-07T09:00:00-08:00');
      const notification: SentNotification = {
        userId: 'user1',
        notificationSetId: 'set1',
        notificationSetKey: 'key1',
        streetName: 'Test St',
        blocksSummary: '100 (N side)',
        cleaningDate: createMockTimestamp(new Date('2025-01-07T00:00:00-08:00')),
        cleaningStart: createMockTimestamp(new Date('2025-01-07T08:00:00-08:00')),
        cleaningEnd: createMockTimestamp(new Date('2025-01-07T10:00:00-08:00')),
        stage: '1hr',
        sentAt: createMockTimestamp(new Date('2025-01-07T07:00:00-08:00')),
        acknowledged: false,
        acknowledgedAt: null,
      };

      expect(hasActiveAlert('set1', [notification], now)).toBe(true);
    });

    it('returns false when notification is acknowledged', () => {
      const now = new Date('2025-01-07T09:00:00-08:00');
      const notification: SentNotification = {
        userId: 'user1',
        notificationSetId: 'set1',
        notificationSetKey: 'key1',
        streetName: 'Test St',
        blocksSummary: '100 (N side)',
        cleaningDate: createMockTimestamp(new Date('2025-01-07T00:00:00-08:00')),
        cleaningStart: createMockTimestamp(new Date('2025-01-07T08:00:00-08:00')),
        cleaningEnd: createMockTimestamp(new Date('2025-01-07T10:00:00-08:00')),
        stage: '1hr',
        sentAt: createMockTimestamp(new Date('2025-01-07T07:00:00-08:00')),
        acknowledged: true,
        acknowledgedAt: createMockTimestamp(new Date('2025-01-07T07:30:00-08:00')),
      };

      expect(hasActiveAlert('set1', [notification], now)).toBe(false);
    });

    it('returns false when cleaning has ended', () => {
      const now = new Date('2025-01-07T11:00:00-08:00'); // After cleaning ends
      const notification: SentNotification = {
        userId: 'user1',
        notificationSetId: 'set1',
        notificationSetKey: 'key1',
        streetName: 'Test St',
        blocksSummary: '100 (N side)',
        cleaningDate: createMockTimestamp(new Date('2025-01-07T00:00:00-08:00')),
        cleaningStart: createMockTimestamp(new Date('2025-01-07T08:00:00-08:00')),
        cleaningEnd: createMockTimestamp(new Date('2025-01-07T10:00:00-08:00')),
        stage: '1hr',
        sentAt: createMockTimestamp(new Date('2025-01-07T07:00:00-08:00')),
        acknowledged: false,
        acknowledgedAt: null,
      };

      expect(hasActiveAlert('set1', [notification], now)).toBe(false);
    });
  });

  describe('getRelativeTimeDescription', () => {
    it('returns TODAY for same day', () => {
      const now = new Date('2025-01-06T12:00:00-08:00');
      const sameDay = new Date('2025-01-06T18:00:00-08:00');

      expect(getRelativeTimeDescription(sameDay, now)).toBe('TODAY');
    });

    it('returns TOMORROW for next day', () => {
      const now = new Date('2025-01-06T12:00:00-08:00');
      const tomorrow = new Date('2025-01-07T08:00:00-08:00');

      expect(getRelativeTimeDescription(tomorrow, now)).toBe('TOMORROW');
    });

    it('returns formatted date for other days', () => {
      const now = new Date('2025-01-06T12:00:00-08:00');
      const laterDate = new Date('2025-01-10T08:00:00-08:00');

      const result = getRelativeTimeDescription(laterDate, now);
      expect(result).toContain('Jan');
      expect(result).toContain('10');
    });
  });

  describe('getStageLabel', () => {
    it('returns correct labels for each stage', () => {
      expect(getStageLabel('night_before')).toBe('8pm night before');
      expect(getStageLabel('1hr')).toBe('1 hour before');
      expect(getStageLabel('30min')).toBe('30 minutes before');
      expect(getStageLabel('10min')).toBe('10 minutes before');
    });
  });

  describe('formatDateForDisplay', () => {
    it('formats date correctly', () => {
      const date = new Date('2025-01-06T12:00:00-08:00');
      const result = formatDateForDisplay(date);

      expect(result).toContain('Mon');
      expect(result).toContain('Jan');
      expect(result).toContain('6');
    });
  });

  describe('formatTimeForDisplay', () => {
    it('formats time correctly', () => {
      const morning = new Date('2025-01-06T08:00:00-08:00');
      expect(formatTimeForDisplay(morning)).toMatch(/8:00\s*AM/i);

      const evening = new Date('2025-01-06T20:30:00-08:00');
      expect(formatTimeForDisplay(evening)).toMatch(/8:30\s*PM/i);
    });
  });
});
