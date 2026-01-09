import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { createPrivateKey } from 'crypto';

let adminApp: App;
let adminDb: Firestore;

function getPrivateKey(): string {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!key) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  // Handle escaped newlines from environment variables
  const pemKey = key.replace(/\\n/g, '\n');

  // Convert key to PKCS#8 format for OpenSSL 3.x compatibility
  // This handles both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats
  try {
    const privateKey = createPrivateKey(pemKey);
    return privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  } catch {
    // If conversion fails, return the original key and let Firebase handle it
    return pemKey;
  }
}

export function getAdminApp(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length === 0) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: getPrivateKey(),
        }),
      });
    } else {
      adminApp = apps[0];
    }
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}
