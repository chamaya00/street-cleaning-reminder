import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendVerificationCode } from '@/lib/twilio';
import { formatPhoneToE164, isValidPhoneNumber, generateVerificationCode } from '@/lib/utils';
import { SendCodeRequest, SendCodeResponse } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// Rate limiting: max 3 codes per phone per 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CODES_PER_WINDOW = 3;
const CODE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest): Promise<NextResponse<SendCodeResponse>> {
  try {
    const body = await request.json() as SendCodeRequest;

    if (!body.phone) {
      return NextResponse.json(
        { success: false, message: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Format and validate phone number
    const phone = formatPhoneToE164(body.phone);
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number. Please enter a valid US phone number.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = Date.now();

    // Check rate limiting
    const recentCodesSnapshot = await db
      .collection('verificationCodes')
      .where('phone', '==', phone)
      .where('createdAt', '>', Timestamp.fromMillis(now - RATE_LIMIT_WINDOW_MS))
      .get();

    if (recentCodesSnapshot.size >= MAX_CODES_PER_WINDOW) {
      return NextResponse.json(
        { success: false, message: 'Too many verification attempts. Please try again in 15 minutes.' },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Timestamp.fromMillis(now + CODE_EXPIRATION_MS);

    // Store verification code in Firestore
    await db.collection('verificationCodes').add({
      phone,
      code,
      expiresAt,
      createdAt: Timestamp.fromMillis(now),
      attempts: 0,
    });

    // Send SMS
    const smsResult = await sendVerificationCode(phone, code);

    if (!smsResult.success) {
      console.error('Failed to send verification SMS:', smsResult.error);
      return NextResponse.json(
        { success: false, message: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error) {
    console.error('Error in send-code:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
