import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { setSessionCookie } from '@/lib/auth';
import { formatPhoneToE164, isValidPhoneNumber, generateToken } from '@/lib/utils';
import { VerifyCodeRequest, VerifyCodeResponse, VerificationCode } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const MAX_VERIFICATION_ATTEMPTS = 5;

export async function POST(request: NextRequest): Promise<NextResponse<VerifyCodeResponse>> {
  try {
    const body = await request.json() as VerifyCodeRequest;

    if (!body.phone || !body.code) {
      return NextResponse.json(
        { success: false, message: 'Phone number and verification code are required' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(body.code)) {
      return NextResponse.json(
        { success: false, message: 'Invalid verification code format' },
        { status: 400 }
      );
    }

    // Format and validate phone number
    const phone = formatPhoneToE164(body.phone);
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = Timestamp.now();

    // Find valid verification code for this phone
    const codesSnapshot = await db
      .collection('verificationCodes')
      .where('phone', '==', phone)
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .limit(1)
      .get();

    if (codesSnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'Verification code expired. Please request a new code.' },
        { status: 400 }
      );
    }

    const codeDoc = codesSnapshot.docs[0];
    const codeData = codeDoc.data() as VerificationCode;

    // Check max attempts
    if (codeData.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return NextResponse.json(
        { success: false, message: 'Too many failed attempts. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check if code matches
    if (codeData.code !== body.code) {
      // Increment attempts
      await codeDoc.ref.update({
        attempts: codeData.attempts + 1,
      });

      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - codeData.attempts - 1;
      return NextResponse.json(
        {
          success: false,
          message: remainingAttempts > 0
            ? `Incorrect code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
            : 'Incorrect code. Please request a new code.'
        },
        { status: 400 }
      );
    }

    // Code is valid - delete it
    await codeDoc.ref.delete();

    // Clean up other expired codes for this phone
    const expiredCodesSnapshot = await db
      .collection('verificationCodes')
      .where('phone', '==', phone)
      .get();

    const batch = db.batch();
    expiredCodesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Find or create user
    const usersSnapshot = await db
      .collection('users')
      .where('phone', '==', phone)
      .limit(1)
      .get();

    let userId: string;
    let alertToken: string;

    if (usersSnapshot.empty) {
      // Create new user
      alertToken = generateToken();
      const newUserRef = db.collection('users').doc();
      userId = newUserRef.id;

      await newUserRef.set({
        phone,
        phoneVerified: true,
        alertToken,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing user
      const userDoc = usersSnapshot.docs[0];
      userId = userDoc.id;
      const existingUser = userDoc.data();
      alertToken = existingUser.alertToken;

      await userDoc.ref.update({
        phoneVerified: true,
        updatedAt: now,
      });
    }

    // Set session cookie
    await setSessionCookie(userId);

    return NextResponse.json({
      success: true,
      alertToken,
    });
  } catch (error) {
    console.error('Error in verify:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
