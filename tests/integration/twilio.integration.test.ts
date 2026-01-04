/**
 * Integration tests for Twilio SMS.
 *
 * These tests verify that:
 * 1. Twilio client initializes with real credentials
 * 2. Account is accessible and valid
 * 3. Phone number is configured correctly
 *
 * Note: These tests do NOT send actual SMS messages to avoid costs.
 * They verify the connection and configuration are correct.
 *
 * Requirements:
 * - Valid Twilio account SID and auth token
 * - Configured Twilio phone number
 */
import { describe, it, expect } from '@jest/globals';
import twilio from 'twilio';

describe('Twilio Integration', () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER!;

  let client: twilio.Twilio;

  beforeAll(() => {
    client = twilio(accountSid, authToken);
  });

  it('should have valid Twilio credentials format', () => {
    // Account SID should start with 'AC' (or 'AC' for test credentials)
    expect(accountSid).toMatch(/^AC[a-f0-9]{32}$/i);

    // Auth token should be 32 hex characters
    expect(authToken).toMatch(/^[a-f0-9]{32}$/i);

    // Phone number should be E.164 format
    expect(phoneNumber).toMatch(/^\+1\d{10}$/);
  });

  it('should connect to Twilio API and fetch account info', async () => {
    const account = await client.api.accounts(accountSid).fetch();

    expect(account.sid).toBe(accountSid);
    expect(account.status).toBe('active');
    console.log(`Connected to Twilio account: ${account.friendlyName}`);
  });

  it('should verify the configured phone number exists', async () => {
    // Fetch incoming phone numbers to verify our number is configured
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });

    const configuredNumber = incomingNumbers.find(
      (num) => num.phoneNumber === phoneNumber
    );

    expect(configuredNumber).toBeDefined();
    console.log(`Verified phone number: ${configuredNumber?.friendlyName || phoneNumber}`);

    // Check SMS capability
    if (configuredNumber) {
      expect(configuredNumber.capabilities?.sms).toBe(true);
    }
  });

  it('should be able to look up phone number capabilities', async () => {
    // Use Twilio Lookup API to verify our number
    const lookup = await client.lookups.v2.phoneNumbers(phoneNumber).fetch();

    expect(lookup.phoneNumber).toBe(phoneNumber);
    expect(lookup.valid).toBe(true);
    console.log(`Phone number country: ${lookup.countryCode}`);
  });

  describe('Message validation (no actual sending)', () => {
    it('should validate message format without sending', () => {
      // Test message formats used in the app
      const testMessages = [
        {
          name: 'verification code',
          body: 'Your SF Street Cleaning Reminder verification code is: 123456. This code expires in 5 minutes.',
        },
        {
          name: 'night before reminder',
          body: 'Reminder: Chestnut St 2800-3000 (N side) has street cleaning tomorrow 8-10am. Reply 1 to dismiss. https://example.com/n',
        },
        {
          name: '1hr reminder',
          body: 'Chestnut St 2800-3000 (N side) cleaning in 1 hr (8-10am). Reply 1 to dismiss. https://example.com/n',
        },
        {
          name: '10min reminder',
          body: 'FINAL: Chestnut St 2800-3000 (N side) cleaning in 10 min! Reply 1 to dismiss. https://example.com/n',
        },
      ];

      for (const msg of testMessages) {
        // Verify messages are reasonable SMS length (160 chars = 1 segment)
        // Multi-segment is OK but expensive
        const segments = Math.ceil(msg.body.length / 160);
        console.log(`${msg.name}: ${msg.body.length} chars (${segments} segment${segments > 1 ? 's' : ''})`);

        // Messages should be under 320 chars (2 segments max for cost efficiency)
        expect(msg.body.length).toBeLessThan(320);
      }
    });
  });

  // Optional: Only run this test if TEST_PHONE_NUMBER is set
  // This actually sends an SMS, so it costs money
  const testRecipient = process.env.TEST_PHONE_NUMBER;

  (testRecipient ? it : it.skip)(
    'should send a real SMS to test number',
    async () => {
      if (!testRecipient) {
        console.log('Skipping real SMS test - TEST_PHONE_NUMBER not set');
        return;
      }

      const message = await client.messages.create({
        body: `[TEST] SF Street Cleaning integration test at ${new Date().toISOString()}`,
        from: phoneNumber,
        to: testRecipient,
      });

      expect(message.sid).toMatch(/^SM[a-f0-9]{32}$/i);
      expect(message.status).toMatch(/^(queued|sent|delivered)$/);
      console.log(`Sent test SMS: ${message.sid} (status: ${message.status})`);
    }
  );
});
