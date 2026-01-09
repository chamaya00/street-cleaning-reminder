import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getFirebaseInitLogs } from '@/lib/firebase-admin';
import { sendVerificationCode } from '@/lib/twilio';
import { formatPhoneToE164, isValidPhoneNumber, generateVerificationCode } from '@/lib/utils';
import { SendCodeRequest, SendCodeResponse } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// Rate limiting: max 3 codes per phone per 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CODES_PER_WINDOW = 3;
const CODE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Generate a short debug ID for tracing errors
function generateDebugId(): string {
  return `SC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

// Extended response type for debugging
interface FirebaseInitLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
  data?: Record<string, unknown>;
}

interface SendCodeDebugResponse extends SendCodeResponse {
  debugId?: string;
  debugInfo?: {
    step: string;
    errorType?: string;
    errorMessage?: string;
    timestamp: string;
    firebaseInitLogs?: FirebaseInitLog[];
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<SendCodeDebugResponse>> {
  const debugId = generateDebugId();
  const debugLog = (step: string, data?: Record<string, unknown>) => {
    console.log(`[${debugId}] ${step}`, data ? JSON.stringify(data, null, 2) : '');
  };

  try {
    debugLog('START', { timestamp: new Date().toISOString() });

    const body = await request.json() as SendCodeRequest;
    debugLog('PARSED_BODY', { phoneProvided: !!body.phone, phoneLength: body.phone?.length });

    if (!body.phone) {
      debugLog('VALIDATION_FAILED', { reason: 'phone_missing' });
      return NextResponse.json(
        { success: false, message: 'Phone number is required', debugId },
        { status: 400 }
      );
    }

    // Format and validate phone number
    const phone = formatPhoneToE164(body.phone);
    debugLog('PHONE_FORMATTED', { original: body.phone, formatted: phone });

    if (!isValidPhoneNumber(phone)) {
      debugLog('VALIDATION_FAILED', { reason: 'invalid_phone', phone });
      return NextResponse.json(
        { success: false, message: 'Invalid phone number. Please enter a valid US phone number.', debugId },
        { status: 400 }
      );
    }

    debugLog('GETTING_FIRESTORE');
    let db;
    try {
      db = getAdminDb();
      debugLog('FIRESTORE_INITIALIZED');
    } catch (dbInitError) {
      const errMsg = dbInitError instanceof Error ? dbInitError.message : String(dbInitError);
      debugLog('FIRESTORE_INIT_FAILED', { error: errMsg });
      return NextResponse.json(
        {
          success: false,
          message: 'An unexpected error occurred. Please try again.',
          debugId,
          debugInfo: {
            step: 'FIRESTORE_INIT',
            errorType: dbInitError instanceof Error ? dbInitError.name : 'Unknown',
            errorMessage: errMsg,
            timestamp: new Date().toISOString(),
            firebaseInitLogs: getFirebaseInitLogs(),
          }
        },
        { status: 500 }
      );
    }

    const now = Date.now();

    // Check rate limiting
    debugLog('CHECKING_RATE_LIMIT');
    let recentCodesSnapshot;
    try {
      recentCodesSnapshot = await db
        .collection('verificationCodes')
        .where('phone', '==', phone)
        .where('createdAt', '>', Timestamp.fromMillis(now - RATE_LIMIT_WINDOW_MS))
        .get();
      debugLog('RATE_LIMIT_QUERY_SUCCESS', { existingCodes: recentCodesSnapshot.size });
    } catch (rateLimitError) {
      const errMsg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
      debugLog('RATE_LIMIT_QUERY_FAILED', { error: errMsg });
      return NextResponse.json(
        {
          success: false,
          message: 'An unexpected error occurred. Please try again.',
          debugId,
          debugInfo: {
            step: 'RATE_LIMIT_QUERY',
            errorType: rateLimitError instanceof Error ? rateLimitError.name : 'Unknown',
            errorMessage: errMsg,
            timestamp: new Date().toISOString(),
            firebaseInitLogs: getFirebaseInitLogs(),
          }
        },
        { status: 500 }
      );
    }

    if (recentCodesSnapshot.size >= MAX_CODES_PER_WINDOW) {
      debugLog('RATE_LIMIT_EXCEEDED', { count: recentCodesSnapshot.size, max: MAX_CODES_PER_WINDOW });
      return NextResponse.json(
        { success: false, message: 'Too many verification attempts. Please try again in 15 minutes.', debugId },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Timestamp.fromMillis(now + CODE_EXPIRATION_MS);
    debugLog('CODE_GENERATED', { expiresAt: new Date(now + CODE_EXPIRATION_MS).toISOString() });

    // Store verification code in Firestore
    debugLog('STORING_CODE');
    try {
      await db.collection('verificationCodes').add({
        phone,
        code,
        expiresAt,
        createdAt: Timestamp.fromMillis(now),
        attempts: 0,
      });
      debugLog('CODE_STORED');
    } catch (storeError) {
      const errMsg = storeError instanceof Error ? storeError.message : String(storeError);
      debugLog('CODE_STORE_FAILED', { error: errMsg });
      return NextResponse.json(
        {
          success: false,
          message: 'An unexpected error occurred. Please try again.',
          debugId,
          debugInfo: {
            step: 'STORE_CODE',
            errorType: storeError instanceof Error ? storeError.name : 'Unknown',
            errorMessage: errMsg,
            timestamp: new Date().toISOString(),
            firebaseInitLogs: getFirebaseInitLogs(),
          }
        },
        { status: 500 }
      );
    }

    // Send SMS
    debugLog('SENDING_SMS');
    let smsResult;
    try {
      smsResult = await sendVerificationCode(phone, code);
      debugLog('SMS_RESULT', { success: smsResult.success, messageId: smsResult.messageId, error: smsResult.error });
    } catch (smsError) {
      const errMsg = smsError instanceof Error ? smsError.message : String(smsError);
      debugLog('SMS_EXCEPTION', { error: errMsg });
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to send verification code. Please try again.',
          debugId,
          debugInfo: {
            step: 'SEND_SMS',
            errorType: smsError instanceof Error ? smsError.name : 'Unknown',
            errorMessage: errMsg,
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }

    if (!smsResult.success) {
      debugLog('SMS_FAILED', { error: smsResult.error });
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to send verification code. Please try again.',
          debugId,
          debugInfo: {
            step: 'SMS_DELIVERY',
            errorType: 'TwilioError',
            errorMessage: smsResult.error || 'Unknown SMS error',
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }

    debugLog('SUCCESS');
    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully',
      debugId,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[${debugId}] UNEXPECTED_ERROR:`, {
      message: errMsg,
      stack: errStack,
      type: error instanceof Error ? error.name : typeof error
    });
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        debugId,
        debugInfo: {
          step: 'UNEXPECTED',
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorMessage: errMsg,
          timestamp: new Date().toISOString(),
          firebaseInitLogs: getFirebaseInitLogs(),
        }
      },
      { status: 500 }
    );
  }
}
