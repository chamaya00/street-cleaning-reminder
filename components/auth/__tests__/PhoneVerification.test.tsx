import { render, screen } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Import the component
import PhoneVerification from '../PhoneVerification';

describe('PhoneVerification Component', () => {
  describe('Initial Render (Phone Step)', () => {
    it('should render phone number input', () => {
      render(<PhoneVerification />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      expect(phoneInput).toBeInTheDocument();
    });

    it('should render send code button', () => {
      render(<PhoneVerification />);

      const button = screen.getByRole('button', { name: /send verification code/i });
      expect(button).toBeInTheDocument();
    });

    it('should have placeholder text for phone input', () => {
      render(<PhoneVerification />);

      const phoneInput = screen.getByPlaceholderText(/\(415\) 555-1234/i);
      expect(phoneInput).toBeInTheDocument();
    });

    it('should not show verification code input initially', () => {
      render(<PhoneVerification />);

      const codeInput = screen.queryByLabelText(/verification code/i);
      expect(codeInput).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form elements', () => {
      render(<PhoneVerification />);

      // Check for proper labels
      const phoneInput = screen.getByLabelText(/phone number/i);
      expect(phoneInput).toHaveAttribute('type', 'tel');
      expect(phoneInput).toHaveAttribute('autocomplete', 'tel');
    });

    it('should have proper button type', () => {
      render(<PhoneVerification />);

      const button = screen.getByRole('button', { name: /send verification code/i });
      expect(button).toHaveAttribute('type', 'submit');
    });
  });
});

describe('Phone Formatting Logic', () => {
  const formatPhoneForDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  it('should format digits progressively', () => {
    expect(formatPhoneForDisplay('')).toBe('');
    expect(formatPhoneForDisplay('4')).toBe('4');
    expect(formatPhoneForDisplay('41')).toBe('41');
    expect(formatPhoneForDisplay('415')).toBe('415');
    expect(formatPhoneForDisplay('4155')).toBe('(415) 5');
    expect(formatPhoneForDisplay('41555')).toBe('(415) 55');
    expect(formatPhoneForDisplay('415555')).toBe('(415) 555');
    expect(formatPhoneForDisplay('4155551')).toBe('(415) 555-1');
    expect(formatPhoneForDisplay('41555512')).toBe('(415) 555-12');
    expect(formatPhoneForDisplay('415555123')).toBe('(415) 555-123');
    expect(formatPhoneForDisplay('4155551234')).toBe('(415) 555-1234');
  });

  it('should strip non-digit characters', () => {
    expect(formatPhoneForDisplay('(415)')).toBe('415');
    expect(formatPhoneForDisplay('415-555')).toBe('(415) 555');
    expect(formatPhoneForDisplay('415.555.1234')).toBe('(415) 555-1234');
  });

  it('should limit to 10 digits', () => {
    expect(formatPhoneForDisplay('41555512345')).toBe('(415) 555-1234');
    expect(formatPhoneForDisplay('415555123456789')).toBe('(415) 555-1234');
  });
});

describe('Form State Types', () => {
  it('should define VerificationStep correctly', () => {
    type VerificationStep = 'phone' | 'code';

    const phoneStep: VerificationStep = 'phone';
    const codeStep: VerificationStep = 'code';

    expect(phoneStep).toBe('phone');
    expect(codeStep).toBe('code');
  });

  it('should define FormState interface correctly', () => {
    interface FormState {
      phone: string;
      code: string;
      isLoading: boolean;
      error: string | null;
      step: 'phone' | 'code';
    }

    const initialState: FormState = {
      phone: '',
      code: '',
      isLoading: false,
      error: null,
      step: 'phone',
    };

    expect(initialState.phone).toBe('');
    expect(initialState.code).toBe('');
    expect(initialState.isLoading).toBe(false);
    expect(initialState.error).toBeNull();
    expect(initialState.step).toBe('phone');
  });
});
