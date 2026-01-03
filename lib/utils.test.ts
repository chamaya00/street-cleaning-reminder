import { describe, it, expect } from '@jest/globals';
import {
  formatSchedule,
  formatTime,
  formatBlockRange,
  formatBlocksSummary,
  generateSetKey,
  generateToken,
  generateVerificationCode,
  isValidPhoneNumber,
  formatPhoneToE164,
} from './utils';
import type { CleaningSchedule } from './types';

describe('formatSchedule', () => {
  it('should format weekly schedule correctly', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 1, // Monday
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };
    expect(formatSchedule(schedule)).toBe('Mondays 8am-10am, weekly');
  });

  it('should format 1st of month schedule correctly', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 3, // Wednesday
      startTime: '09:00',
      endTime: '11:00',
      frequency: '1st',
    };
    expect(formatSchedule(schedule)).toBe('Wednesdays 9am-11am, 1st of month');
  });

  it('should format 1st & 3rd schedule correctly', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 5, // Friday
      startTime: '12:00',
      endTime: '14:00',
      frequency: '1st_3rd',
    };
    expect(formatSchedule(schedule)).toBe('Fridays 12pm-2pm, 1st & 3rd of month');
  });

  it('should format 2nd & 4th schedule correctly', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 2, // Tuesday
      startTime: '13:00',
      endTime: '15:00',
      frequency: '2nd_4th',
    };
    expect(formatSchedule(schedule)).toBe('Tuesdays 1pm-3pm, 2nd & 4th of month');
  });
});

describe('formatTime', () => {
  it('should format midnight correctly', () => {
    expect(formatTime('00:00')).toBe('12am');
  });

  it('should format morning times correctly', () => {
    expect(formatTime('08:00')).toBe('8am');
    expect(formatTime('09:30')).toBe('9:30am');
  });

  it('should format noon correctly', () => {
    expect(formatTime('12:00')).toBe('12pm');
  });

  it('should format afternoon times correctly', () => {
    expect(formatTime('13:00')).toBe('1pm');
    expect(formatTime('14:30')).toBe('2:30pm');
  });

  it('should format evening times correctly', () => {
    expect(formatTime('20:00')).toBe('8pm');
    expect(formatTime('23:59')).toBe('11:59pm');
  });

  it('should pad minutes with zero when needed', () => {
    expect(formatTime('08:05')).toBe('8:05am');
  });
});

describe('formatBlockRange', () => {
  it('should handle empty array', () => {
    expect(formatBlockRange([])).toBe('');
  });

  it('should handle single block', () => {
    expect(formatBlockRange([2800])).toBe('2800');
  });

  it('should format contiguous range', () => {
    expect(formatBlockRange([2800, 2900, 3000])).toBe('2800-3000');
  });

  it('should format non-contiguous blocks', () => {
    expect(formatBlockRange([2800, 3100])).toBe('2800, 3100');
  });

  it('should format mixed contiguous and non-contiguous blocks', () => {
    expect(formatBlockRange([2800, 2900, 3100])).toBe('2800-2900, 3100');
  });

  it('should sort blocks before formatting', () => {
    expect(formatBlockRange([3000, 2800, 2900])).toBe('2800-3000');
  });

  it('should handle multiple ranges', () => {
    expect(formatBlockRange([2800, 2900, 3100, 3200, 3400])).toBe('2800-2900, 3100-3200, 3400');
  });
});

describe('formatBlocksSummary', () => {
  it('should format north side correctly', () => {
    expect(formatBlocksSummary([2800, 2900], 'N')).toBe('2800-2900 (N side)');
  });

  it('should format south side correctly', () => {
    expect(formatBlocksSummary([3000], 'S')).toBe('3000 (S side)');
  });

  it('should format both sides correctly', () => {
    expect(formatBlocksSummary([2800, 2900, 3000], 'both')).toBe('2800-3000 (both sides)');
  });
});

describe('generateSetKey', () => {
  it('should generate deterministic key for same inputs', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    const key1 = generateSetKey('user123', 'Chestnut St', schedule);
    const key2 = generateSetKey('user123', 'Chestnut St', schedule);

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different users', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    const key1 = generateSetKey('user123', 'Chestnut St', schedule);
    const key2 = generateSetKey('user456', 'Chestnut St', schedule);

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different schedules', () => {
    const schedule1: CleaningSchedule = {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    const schedule2: CleaningSchedule = {
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    const key1 = generateSetKey('user123', 'Chestnut St', schedule1);
    const key2 = generateSetKey('user123', 'Chestnut St', schedule2);

    expect(key1).not.toBe(key2);
  });

  it('should include all schedule components in key', () => {
    const schedule: CleaningSchedule = {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      frequency: 'weekly',
    };

    const key = generateSetKey('user123', 'Chestnut St', schedule);
    expect(key).toBe('user123:Chestnut St:1-08:00-10:00-weekly');
  });
});

describe('generateToken', () => {
  it('should generate token of default length (32)', () => {
    const token = generateToken();
    expect(token).toHaveLength(32);
  });

  it('should generate token of specified length', () => {
    const token = generateToken(16);
    expect(token).toHaveLength(16);
  });

  it('should only contain alphanumeric characters', () => {
    const token = generateToken(100);
    expect(token).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('should generate different tokens on each call', () => {
    const token1 = generateToken();
    const token2 = generateToken();
    expect(token1).not.toBe(token2);
  });
});

describe('generateVerificationCode', () => {
  it('should generate 6-digit code', () => {
    const code = generateVerificationCode();
    expect(code).toHaveLength(6);
  });

  it('should only contain digits', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('should not start with 0', () => {
    // Run multiple times to ensure consistency
    for (let i = 0; i < 100; i++) {
      const code = generateVerificationCode();
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThanOrEqual(999999);
    }
  });
});

describe('isValidPhoneNumber', () => {
  it('should accept valid E.164 US phone numbers', () => {
    expect(isValidPhoneNumber('+14155551234')).toBe(true);
    expect(isValidPhoneNumber('+12025551234')).toBe(true);
  });

  it('should reject phone numbers without country code', () => {
    expect(isValidPhoneNumber('4155551234')).toBe(false);
  });

  it('should reject phone numbers without plus sign', () => {
    expect(isValidPhoneNumber('14155551234')).toBe(false);
  });

  it('should reject phone numbers with wrong country code', () => {
    expect(isValidPhoneNumber('+44155551234')).toBe(false);
  });

  it('should reject phone numbers with too few digits', () => {
    expect(isValidPhoneNumber('+1415555123')).toBe(false);
  });

  it('should reject phone numbers with too many digits', () => {
    expect(isValidPhoneNumber('+141555512345')).toBe(false);
  });

  it('should reject non-numeric characters', () => {
    expect(isValidPhoneNumber('+1415-555-1234')).toBe(false);
  });
});

describe('formatPhoneToE164', () => {
  it('should format 10-digit number', () => {
    expect(formatPhoneToE164('4155551234')).toBe('+14155551234');
  });

  it('should format number with dashes', () => {
    expect(formatPhoneToE164('415-555-1234')).toBe('+14155551234');
  });

  it('should format number with parentheses', () => {
    expect(formatPhoneToE164('(415) 555-1234')).toBe('+14155551234');
  });

  it('should format number with spaces', () => {
    expect(formatPhoneToE164('415 555 1234')).toBe('+14155551234');
  });

  it('should handle 11-digit number starting with 1', () => {
    expect(formatPhoneToE164('14155551234')).toBe('+14155551234');
  });

  it('should handle number already in E.164 format', () => {
    expect(formatPhoneToE164('+14155551234')).toBe('+14155551234');
  });

  it('should handle mixed formatting', () => {
    expect(formatPhoneToE164('1 (415) 555-1234')).toBe('+14155551234');
  });
});
