'use client';

import { useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type VerificationStep = 'phone' | 'code';

interface FormState {
  phone: string;
  code: string;
  isLoading: boolean;
  error: string | null;
  step: VerificationStep;
}

export default function PhoneVerification() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({
    phone: '',
    code: '',
    isLoading: false,
    error: null,
    step: 'phone',
  });

  const formatPhoneForDisplay = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneForDisplay(e.target.value);
    setFormState(prev => ({ ...prev, phone: formatted, error: null }));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 6
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormState(prev => ({ ...prev, code: value, error: null }));
  };

  const handleSendCode = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    const digits = formState.phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setFormState(prev => ({ ...prev, error: 'Please enter a valid 10-digit phone number' }));
      return;
    }

    setFormState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFormState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Failed to send verification code',
        }));
        return;
      }

      setFormState(prev => ({
        ...prev,
        isLoading: false,
        step: 'code',
      }));
    } catch {
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Network error. Please check your connection and try again.',
      }));
    }
  }, [formState.phone]);

  const handleVerifyCode = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    if (formState.code.length !== 6) {
      setFormState(prev => ({ ...prev, error: 'Please enter the 6-digit code' }));
      return;
    }

    setFormState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const digits = formState.phone.replace(/\D/g, '');
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, code: formState.code }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFormState(prev => ({
          ...prev,
          isLoading: false,
          error: data.message || 'Verification failed',
        }));
        return;
      }

      // Success - redirect to home
      router.push('/');
    } catch {
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Network error. Please check your connection and try again.',
      }));
    }
  }, [formState.phone, formState.code, router]);

  const handleBack = () => {
    setFormState(prev => ({ ...prev, step: 'phone', code: '', error: null }));
  };

  const handleResendCode = async () => {
    setFormState(prev => ({ ...prev, code: '', error: null }));
    const fakeEvent = { preventDefault: () => {} } as FormEvent;
    await handleSendCode(fakeEvent);
  };

  return (
    <div className="w-full max-w-sm">
      {formState.step === 'phone' ? (
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={formState.phone}
              onChange={handlePhoneChange}
              placeholder="(415) 555-1234"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={formState.isLoading}
              autoComplete="tel"
            />
          </div>

          {formState.error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {formState.error}
            </p>
          )}

          <button
            type="submit"
            disabled={formState.isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none"
          >
            {formState.isLoading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
          <div className="text-center mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              We sent a code to <span className="font-medium">{formState.phone}</span>
            </p>
            <button
              type="button"
              onClick={handleBack}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Change number
            </button>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              id="code"
              value={formState.code}
              onChange={handleCodeChange}
              placeholder="123456"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-center text-2xl tracking-widest"
              disabled={formState.isLoading}
              autoComplete="one-time-code"
              maxLength={6}
            />
          </div>

          {formState.error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {formState.error}
            </p>
          )}

          <button
            type="submit"
            disabled={formState.isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none"
          >
            {formState.isLoading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={formState.isLoading}
            className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Didn&apos;t receive the code? Resend
          </button>
        </form>
      )}
    </div>
  );
}
