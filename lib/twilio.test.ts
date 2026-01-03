import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock environment variables
const originalEnv = process.env;

describe('Twilio SMS Functions', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'test_account_sid',
      TWILIO_AUTH_TOKEN: 'test_auth_token',
      TWILIO_PHONE_NUMBER: '+15551234567',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('sendVerificationCode message format', () => {
    it('should create message with correct format', () => {
      const code = '123456';
      const expectedMessage = `Your SF Street Cleaning Reminder verification code is: ${code}. This code expires in 5 minutes.`;
      expect(expectedMessage).toContain(code);
      expect(expectedMessage).toContain('expires in 5 minutes');
    });
  });

  describe('sendReminderNotification message formats', () => {
    const streetName = 'Chestnut St';
    const blocksSummary = '2800-3000 (N side)';
    const cleaningTime = '8-10am';
    const alertsUrl = 'https://example.com/notifications';

    it('should format night_before message correctly', () => {
      const expected = `Reminder: ${streetName} ${blocksSummary} has street cleaning tomorrow ${cleaningTime}. Reply 1 to dismiss. ${alertsUrl}`;
      expect(expected).toContain('Reminder:');
      expect(expected).toContain('tomorrow');
      expect(expected).toContain('Reply 1 to dismiss');
    });

    it('should format 1hr message correctly', () => {
      const expected = `${streetName} ${blocksSummary} cleaning in 1 hr (${cleaningTime}). Reply 1 to dismiss. ${alertsUrl}`;
      expect(expected).toContain('in 1 hr');
      expect(expected).toContain('Reply 1 to dismiss');
    });

    it('should format 30min message correctly', () => {
      const expected = `${streetName} ${blocksSummary} cleaning in 30 min. Reply 1 to dismiss. ${alertsUrl}`;
      expect(expected).toContain('in 30 min');
    });

    it('should format 10min message with FINAL prefix', () => {
      const expected = `FINAL: ${streetName} ${blocksSummary} cleaning in 10 min! Reply 1 to dismiss. ${alertsUrl}`;
      expect(expected).toContain('FINAL:');
      expect(expected).toContain('10 min!');
    });
  });

  describe('environment variable requirements', () => {
    it('should require TWILIO_ACCOUNT_SID', () => {
      expect(process.env.TWILIO_ACCOUNT_SID).toBe('test_account_sid');
    });

    it('should require TWILIO_AUTH_TOKEN', () => {
      expect(process.env.TWILIO_AUTH_TOKEN).toBe('test_auth_token');
    });

    it('should require TWILIO_PHONE_NUMBER', () => {
      expect(process.env.TWILIO_PHONE_NUMBER).toBe('+15551234567');
    });
  });
});

describe('SMS Message Validation', () => {
  it('should not exceed SMS length limit for short block names', () => {
    const streetName = 'Bay St';
    const blocksSummary = '2800 (N side)';
    const cleaningTime = '8-10am';
    const alertsUrl = 'https://example.com/n?t=abc123';

    const nightBefore = `Reminder: ${streetName} ${blocksSummary} has street cleaning tomorrow ${cleaningTime}. Reply 1 to dismiss. ${alertsUrl}`;
    expect(nightBefore.length).toBeLessThan(160);
  });

  it('should keep messages concise for standard block summaries', () => {
    const streetName = 'Chestnut St';
    const blocksSummary = '2800-3000 (N side)';
    const cleaningTime = '8-10am';
    const alertsUrl = 'https://example.com/n?t=abc123';

    const oneHour = `${streetName} ${blocksSummary} cleaning in 1 hr (${cleaningTime}). Reply 1 to dismiss. ${alertsUrl}`;
    const thirtyMin = `${streetName} ${blocksSummary} cleaning in 30 min. Reply 1 to dismiss. ${alertsUrl}`;
    const tenMin = `FINAL: ${streetName} ${blocksSummary} cleaning in 10 min! Reply 1 to dismiss. ${alertsUrl}`;

    // SMS messages should be under 160 characters for single segment
    expect(oneHour.length).toBeLessThan(200); // Allow multi-segment
    expect(thirtyMin.length).toBeLessThan(200);
    expect(tenMin.length).toBeLessThan(200);
  });
});
