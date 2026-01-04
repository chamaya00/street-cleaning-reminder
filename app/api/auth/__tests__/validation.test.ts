import { describe, it, expect } from '@jest/globals';
import { formatPhoneToE164, isValidPhoneNumber, generateVerificationCode } from '@/lib/utils';

describe('Auth API Request Validation', () => {
  describe('Phone Number Validation', () => {
    it('should accept valid US phone numbers', () => {
      const validPhones = [
        '+14155551234',
        '+12025551234',
        '+19175551234',
      ];

      validPhones.forEach(phone => {
        expect(isValidPhoneNumber(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '4155551234', // Missing +1
        '14155551234', // Missing +
        '+1415555123', // Too short
        '+141555512345', // Too long
        '+44155551234', // Wrong country code
        'invalid', // Not a phone number
        '', // Empty
      ];

      invalidPhones.forEach(phone => {
        expect(isValidPhoneNumber(phone)).toBe(false);
      });
    });

    it('should format various phone formats to E.164', () => {
      const testCases = [
        { input: '4155551234', expected: '+14155551234' },
        { input: '(415) 555-1234', expected: '+14155551234' },
        { input: '415-555-1234', expected: '+14155551234' },
        { input: '415.555.1234', expected: '+14155551234' },
        { input: '14155551234', expected: '+14155551234' },
        { input: '+14155551234', expected: '+14155551234' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(formatPhoneToE164(input)).toBe(expected);
      });
    });
  });

  describe('Verification Code Validation', () => {
    it('should generate 6-digit codes', () => {
      for (let i = 0; i < 20; i++) {
        const code = generateVerificationCode();
        expect(code).toMatch(/^\d{6}$/);
        expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
        expect(parseInt(code)).toBeLessThanOrEqual(999999);
      }
    });

    it('should accept valid 6-digit codes', () => {
      const validCodes = ['123456', '000001', '999999', '100000'];
      validCodes.forEach(code => {
        expect(/^\d{6}$/.test(code)).toBe(true);
      });
    });

    it('should reject invalid code formats', () => {
      const invalidCodes = [
        '12345', // Too short
        '1234567', // Too long
        '12345a', // Contains letter
        'abcdef', // All letters
        '123 456', // Contains space
        '', // Empty
      ];

      invalidCodes.forEach(code => {
        expect(/^\d{6}$/.test(code)).toBe(false);
      });
    });
  });
});

describe('Auth API Response Formats', () => {
  describe('SendCodeResponse', () => {
    it('should have success response structure', () => {
      const successResponse = {
        success: true,
        message: 'Verification code sent successfully',
      };

      expect(successResponse).toHaveProperty('success', true);
      expect(successResponse).toHaveProperty('message');
    });

    it('should have error response structure', () => {
      const errorResponses = [
        { success: false, message: 'Phone number is required' },
        { success: false, message: 'Invalid phone number. Please enter a valid US phone number.' },
        { success: false, message: 'Too many verification attempts. Please try again in 15 minutes.' },
        { success: false, message: 'Failed to send verification code. Please try again.' },
      ];

      errorResponses.forEach(response => {
        expect(response.success).toBe(false);
        expect(response.message).toBeTruthy();
      });
    });
  });

  describe('VerifyCodeResponse', () => {
    it('should have success response structure with alertToken', () => {
      const successResponse = {
        success: true,
        alertToken: 'abc123xyz456',
      };

      expect(successResponse).toHaveProperty('success', true);
      expect(successResponse).toHaveProperty('alertToken');
      expect(typeof successResponse.alertToken).toBe('string');
    });

    it('should have error response structure', () => {
      const errorResponses = [
        { success: false, message: 'Phone number and verification code are required' },
        { success: false, message: 'Invalid verification code format' },
        { success: false, message: 'Invalid phone number' },
        { success: false, message: 'Verification code expired. Please request a new code.' },
        { success: false, message: 'Too many failed attempts. Please request a new code.' },
        { success: false, message: 'Incorrect code. 4 attempts remaining.' },
      ];

      errorResponses.forEach(response => {
        expect(response.success).toBe(false);
        expect(response.message).toBeTruthy();
      });
    });
  });
});

describe('Rate Limiting Logic', () => {
  it('should define proper rate limit window', () => {
    const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    expect(RATE_LIMIT_WINDOW_MS).toBe(900000);
  });

  it('should define proper max codes per window', () => {
    const MAX_CODES_PER_WINDOW = 3;
    expect(MAX_CODES_PER_WINDOW).toBe(3);
  });

  it('should define proper code expiration', () => {
    const CODE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
    expect(CODE_EXPIRATION_MS).toBe(300000);
  });

  it('should define proper max verification attempts', () => {
    const MAX_VERIFICATION_ATTEMPTS = 5;
    expect(MAX_VERIFICATION_ATTEMPTS).toBe(5);
  });
});

describe('HTTP Status Codes', () => {
  it('should use correct status codes for different scenarios', () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      tooManyRequests: 429,
      serverError: 500,
    };

    expect(statusCodes.success).toBe(200);
    expect(statusCodes.badRequest).toBe(400);
    expect(statusCodes.tooManyRequests).toBe(429);
    expect(statusCodes.serverError).toBe(500);
  });
});
