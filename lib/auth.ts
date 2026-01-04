import { cookies } from 'next/headers';
import { getAdminDb } from './firebase-admin';
import { User } from './types';

const SESSION_COOKIE_NAME = 'sf_street_cleaning_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  userId: string;
  phone: string;
  alertToken: string;
}

export interface AuthResult {
  user: SessionUser | null;
  error?: string;
}

/**
 * Create a session cookie value (userId encoded in base64)
 */
export function createSessionValue(userId: string): string {
  return Buffer.from(userId).toString('base64');
}

/**
 * Parse a session cookie value to get userId
 */
export function parseSessionValue(value: string): string | null {
  try {
    return Buffer.from(value, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Set the session cookie with the given userId
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionValue = createSessionValue(userId);

  cookieStore.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000, // maxAge is in seconds
    path: '/',
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the current session user from cookies
 */
export async function getSessionUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return { user: null };
    }

    const userId = parseSessionValue(sessionCookie.value);
    if (!userId) {
      return { user: null, error: 'Invalid session cookie' };
    }

    // Fetch user from Firestore
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return { user: null, error: 'User not found' };
    }

    const userData = userDoc.data() as User;
    return {
      user: {
        userId,
        phone: userData.phone,
        alertToken: userData.alertToken,
      },
    };
  } catch (error) {
    console.error('Error getting session user:', error);
    return { user: null, error: 'Failed to verify session' };
  }
}

/**
 * Verify an alert token and return the associated user
 */
export async function verifyAlertToken(token: string): Promise<AuthResult> {
  try {
    if (!token || token.length < 10) {
      return { user: null, error: 'Invalid token format' };
    }

    const db = getAdminDb();
    const usersSnapshot = await db
      .collection('users')
      .where('alertToken', '==', token)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return { user: null, error: 'Invalid token' };
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data() as User;

    return {
      user: {
        userId: userDoc.id,
        phone: userData.phone,
        alertToken: userData.alertToken,
      },
    };
  } catch (error) {
    console.error('Error verifying alert token:', error);
    return { user: null, error: 'Failed to verify token' };
  }
}

/**
 * Get user from either session cookie or alert token
 * Prioritizes session cookie, falls back to token
 */
export async function getAuthenticatedUser(alertToken?: string): Promise<AuthResult> {
  // First try session cookie
  const sessionResult = await getSessionUser();
  if (sessionResult.user) {
    return sessionResult;
  }

  // Fall back to alert token if provided
  if (alertToken) {
    return verifyAlertToken(alertToken);
  }

  return { user: null, error: 'Not authenticated' };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(alertToken?: string): Promise<SessionUser> {
  const result = await getAuthenticatedUser(alertToken);
  if (!result.user) {
    throw new Error(result.error || 'Authentication required');
  }
  return result.user;
}
