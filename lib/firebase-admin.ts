import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { createPrivateKey, KeyObject } from 'crypto';

let adminApp: App;
let adminDb: Firestore;

// Log collection for debugging - stores recent init logs to surface in API responses
interface InitLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
  data?: Record<string, unknown>;
}

const initLogs: InitLog[] = [];
const MAX_LOGS = 50;

function addInitLog(level: InitLog['level'], step: string, message: string, data?: Record<string, unknown>) {
  const log: InitLog = {
    timestamp: new Date().toISOString(),
    level,
    step,
    message,
    data,
  };
  initLogs.push(log);
  if (initLogs.length > MAX_LOGS) {
    initLogs.shift();
  }
  // Also log to console for server logs
  const prefix = `[FIREBASE_INIT] [${step}]`;
  if (level === 'error') {
    console.error(prefix, message, data || '');
  } else if (level === 'warn') {
    console.warn(prefix, message, data || '');
  } else {
    console.log(prefix, message, data || '');
  }
}

// Export function to get init logs for API responses
export function getFirebaseInitLogs(): InitLog[] {
  return [...initLogs];
}

// Clear logs (useful for testing)
export function clearFirebaseInitLogs(): void {
  initLogs.length = 0;
}

function detectKeyFormat(pemKey: string): string {
  if (pemKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    return 'PKCS#1 (RSA PRIVATE KEY)';
  } else if (pemKey.includes('-----BEGIN PRIVATE KEY-----')) {
    return 'PKCS#8 (PRIVATE KEY)';
  } else if (pemKey.includes('-----BEGIN EC PRIVATE KEY-----')) {
    return 'EC PRIVATE KEY';
  } else if (pemKey.includes('-----BEGIN')) {
    const match = pemKey.match(/-----BEGIN ([^-]+)-----/);
    return match ? match[1] : 'Unknown PEM format';
  }
  return 'Not a PEM key';
}

function getPrivateKey(): string {
  addInitLog('info', 'GET_PRIVATE_KEY', 'Starting private key retrieval');

  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!key) {
    addInitLog('error', 'GET_PRIVATE_KEY', 'FIREBASE_ADMIN_PRIVATE_KEY is not set');
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }

  addInitLog('info', 'GET_PRIVATE_KEY', 'Raw key loaded from env', {
    keyLength: key.length,
    hasEscapedNewlines: key.includes('\\n'),
    startsWithDash: key.startsWith('-'),
    first30Chars: key.substring(0, 30),
  });

  // Handle escaped newlines from environment variables
  const pemKey = key.replace(/\\n/g, '\n');
  const detectedFormat = detectKeyFormat(pemKey);

  addInitLog('info', 'GET_PRIVATE_KEY', 'Key after newline processing', {
    keyLength: pemKey.length,
    detectedFormat,
    lineCount: pemKey.split('\n').length,
  });

  // Convert key to PKCS#8 format for OpenSSL 3.x compatibility
  // This handles both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats
  addInitLog('info', 'PKCS8_CONVERT', 'Attempting PKCS#8 conversion');

  let privateKeyObj: KeyObject;
  try {
    privateKeyObj = createPrivateKey(pemKey);
    addInitLog('info', 'PKCS8_CONVERT', 'createPrivateKey() succeeded', {
      keyType: privateKeyObj.type,
      asymmetricKeyType: privateKeyObj.asymmetricKeyType,
    });
  } catch (parseError) {
    const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
    addInitLog('error', 'PKCS8_CONVERT', 'createPrivateKey() FAILED - cannot parse key', {
      error: errMsg,
      errorType: parseError instanceof Error ? parseError.name : typeof parseError,
      detectedFormat,
      suggestion: 'The private key may be malformed or corrupted. Check FIREBASE_ADMIN_PRIVATE_KEY env var.',
    });
    // Return original and let Firebase show the real error
    addInitLog('warn', 'PKCS8_CONVERT', 'Falling back to original key (will likely fail on OpenSSL 3.x)');
    return pemKey;
  }

  try {
    const pkcs8Key = privateKeyObj.export({ type: 'pkcs8', format: 'pem' }) as string;
    addInitLog('info', 'PKCS8_CONVERT', 'Successfully exported to PKCS#8 format', {
      outputLength: pkcs8Key.length,
      outputFormat: detectKeyFormat(pkcs8Key),
    });
    return pkcs8Key;
  } catch (exportError) {
    const errMsg = exportError instanceof Error ? exportError.message : String(exportError);
    addInitLog('error', 'PKCS8_CONVERT', 'export() to PKCS#8 FAILED', {
      error: errMsg,
      errorType: exportError instanceof Error ? exportError.name : typeof exportError,
    });
    addInitLog('warn', 'PKCS8_CONVERT', 'Falling back to original key (will likely fail on OpenSSL 3.x)');
    return pemKey;
  }
}

export function getAdminApp(): App {
  if (!adminApp) {
    addInitLog('info', 'GET_ADMIN_APP', 'Initializing Firebase Admin App');
    const apps = getApps();

    if (apps.length === 0) {
      addInitLog('info', 'GET_ADMIN_APP', 'No existing apps, creating new one');

      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

      addInitLog('info', 'GET_ADMIN_APP', 'Credential config', {
        projectId: projectId || '(not set)',
        clientEmail: clientEmail || '(not set)',
        hasProjectId: !!projectId,
        hasClientEmail: !!clientEmail,
      });

      if (!projectId || !clientEmail) {
        addInitLog('error', 'GET_ADMIN_APP', 'Missing required environment variables', {
          missingProjectId: !projectId,
          missingClientEmail: !clientEmail,
        });
      }

      try {
        const privateKey = getPrivateKey();
        addInitLog('info', 'GET_ADMIN_APP', 'Calling initializeApp with cert()');

        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });

        addInitLog('info', 'GET_ADMIN_APP', 'Firebase Admin App initialized successfully');
      } catch (initError) {
        const errMsg = initError instanceof Error ? initError.message : String(initError);
        addInitLog('error', 'GET_ADMIN_APP', 'initializeApp() FAILED', {
          error: errMsg,
          errorType: initError instanceof Error ? initError.name : typeof initError,
          stack: initError instanceof Error ? initError.stack?.split('\n').slice(0, 3).join('\n') : undefined,
        });
        throw initError;
      }
    } else {
      addInitLog('info', 'GET_ADMIN_APP', 'Reusing existing app', { appCount: apps.length });
      adminApp = apps[0];
    }
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    addInitLog('info', 'GET_ADMIN_DB', 'Getting Firestore instance');
    try {
      adminDb = getFirestore(getAdminApp());
      addInitLog('info', 'GET_ADMIN_DB', 'Firestore instance obtained successfully');
    } catch (dbError) {
      const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
      addInitLog('error', 'GET_ADMIN_DB', 'getFirestore() FAILED', {
        error: errMsg,
        errorType: dbError instanceof Error ? dbError.name : typeof dbError,
      });
      throw dbError;
    }
  }
  return adminDb;
}
