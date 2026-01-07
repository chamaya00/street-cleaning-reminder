/**
 * Sync DataSF Street Data to Firestore
 *
 * This script fetches street sweeping schedules and street centerlines from
 * SF Open Data, joins them by CNN, and writes to Firestore.
 *
 * Usage:
 *   npx tsx scripts/sync-datasf.ts
 *
 * Environment variables required:
 *   FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)
 *   FIREBASE_CLIENT_EMAIL (or FIREBASE_ADMIN_CLIENT_EMAIL)
 *   FIREBASE_PRIVATE_KEY (or FIREBASE_ADMIN_PRIVATE_KEY)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local if running locally
dotenv.config({ path: '.env.local' });

// DataSF API endpoints
const SWEEPING_API_URL = 'https://data.sfgov.org/resource/yhqp-riqs.json';
const CENTERLINES_API_URL = 'https://data.sfgov.org/resource/3psu-pn9h.json';

// Fetch limits
const SWEEPING_LIMIT = 99999;
const CENTERLINES_LIMIT = 99999;

// Raw data types from DataSF
interface RawSweepingRecord {
  cnn?: string;
  cnnrightleft?: string;
  streetname?: string;
  corridor?: string;
  fullname?: string;
  limits?: string;
  from_address?: string;
  to_address?: string;
  blockside?: string;
  side?: string;
  weekday?: string;
  day?: string;
  fromhour?: string;
  tohour?: string;
  starttime?: string;
  endtime?: string;
  week1?: string;
  week2?: string;
  week3?: string;
  week4?: string;
  week5?: string;
  holidays?: string;
  line?: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
  the_geom?: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
}

interface RawCenterlineRecord {
  cnn?: string;
  streetname?: string;
  street?: string;
  st_type?: string;
  lf_fadd?: string;
  lf_toadd?: string;
  rt_fadd?: string;
  rt_toadd?: string;
  f_st?: string;
  t_st?: string;
  line?: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
  the_geom?: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
  geometry?: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
}

// Processed data types
interface CleaningSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

interface StreetSegment {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  geometry: string; // GeoJSON stored as string to avoid Firestore nested entity limits
  schedules: CleaningSchedule[];
  syncVersion: string;
  updatedAt: Timestamp;
}

// Day of week mapping
const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function parseDay(day: string | undefined): number | null {
  if (!day) return null;
  const normalized = day.toLowerCase().trim();
  return DAY_MAP[normalized] ?? null;
}

function parseTime(time: string | undefined): string | null {
  if (!time) return null;
  const normalized = time.trim().toLowerCase();

  // HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    const [h, m] = normalized.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }

  // Just hours
  if (/^\d{1,2}$/.test(normalized)) {
    return `${normalized.padStart(2, '0')}:00`;
  }

  // AM/PM format
  const ampmMatch = normalized.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const minutes = ampmMatch[2] || '00';
    const period = ampmMatch[3];
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // HHMM format
  if (/^\d{4}$/.test(normalized)) {
    return `${normalized.slice(0, 2)}:${normalized.slice(2)}`;
  }

  return null;
}

function parseWeeksOfMonth(
  week1?: string,
  week2?: string,
  week3?: string,
  week4?: string
): number[] {
  const weeks: number[] = [];
  if (week1?.toLowerCase() === 'y' || week1 === '1') weeks.push(1);
  if (week2?.toLowerCase() === 'y' || week2 === '1') weeks.push(2);
  if (week3?.toLowerCase() === 'y' || week3 === '1') weeks.push(3);
  if (week4?.toLowerCase() === 'y' || week4 === '1') weeks.push(4);
  // If all weeks, return [1,2,3,4] for weekly
  if (weeks.length === 0) return [1, 2, 3, 4]; // Default to weekly
  return weeks;
}

function normalizeStreetName(name: string | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/^(N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+/i, '')
    .replace(/\bSTREET\b/gi, 'St')
    .replace(/\bAVENUE\b/gi, 'Ave')
    .replace(/\bBOULEVARD\b/gi, 'Blvd')
    .replace(/\bDRIVE\b/gi, 'Dr')
    .replace(/\bWAY\b/gi, 'Way')
    .replace(/\bPLACE\b/gi, 'Pl')
    .replace(/\bCOURT\b/gi, 'Ct')
    .replace(/\bLANE\b/gi, 'Ln')
    .replace(/\bROAD\b/gi, 'Rd')
    .replace(/\bTERRACE\b/gi, 'Ter')
    .replace(/\bCIRCLE\b/gi, 'Cir')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\b(St|Ave|Blvd|Dr|Way|Pl|Ct|Ln|Rd|Ter|Cir)\b/g, match =>
      match.charAt(0).toUpperCase() + match.slice(1)
    );
}

function normalizeCNN(cnn: string | undefined): string {
  if (!cnn) return '';
  // CNN should be a numeric string, remove any non-numeric characters and leading zeros
  return cnn.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0';
}

function parseSide(side: string | undefined): 'North' | 'South' | 'Both' {
  if (!side) return 'Both';
  const normalized = side.toUpperCase();
  if (normalized.includes('N') || normalized.includes('NORTH') || normalized.includes('LEFT')) {
    return 'North';
  }
  if (normalized.includes('S') || normalized.includes('SOUTH') || normalized.includes('RIGHT')) {
    return 'South';
  }
  return 'Both';
}

async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  delay = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Fetching ${url} (attempt ${attempt}/${retries})...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error('All retries failed');
}

async function fetchSweepingData(): Promise<RawSweepingRecord[]> {
  const url = `${SWEEPING_API_URL}?$limit=${SWEEPING_LIMIT}`;
  return fetchWithRetry<RawSweepingRecord[]>(url);
}

async function fetchCenterlinesData(): Promise<RawCenterlineRecord[]> {
  const url = `${CENTERLINES_API_URL}?$limit=${CENTERLINES_LIMIT}`;
  return fetchWithRetry<RawCenterlineRecord[]>(url);
}

interface CenterlineInfo {
  cnn: string;
  streetName: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] | number[];
  };
  fromAddress: string;
  toAddress: string;
}

function processCenterlines(records: RawCenterlineRecord[]): Map<string, CenterlineInfo> {
  const centerlines = new Map<string, CenterlineInfo>();

  for (const record of records) {
    const cnn = normalizeCNN(record.cnn);
    if (!cnn) continue;

    const geometry = record.line || record.the_geom || record.geometry;
    if (!geometry || !geometry.coordinates) continue;

    const streetName = normalizeStreetName(record.streetname || record.street || '');

    // Get address range from various possible fields
    const fromAddress = record.lf_fadd || record.rt_fadd || '';
    const toAddress = record.lf_toadd || record.rt_toadd || '';

    centerlines.set(cnn, {
      cnn,
      streetName,
      geometry,
      fromAddress,
      toAddress,
    });
  }

  return centerlines;
}

interface SweepingInfo {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  schedules: CleaningSchedule[];
}

function processSweepingData(records: RawSweepingRecord[]): Map<string, SweepingInfo> {
  const sweepingByCNN = new Map<string, SweepingInfo>();

  for (const record of records) {
    // Try multiple CNN fields
    const cnn = normalizeCNN(record.cnn || record.cnnrightleft);
    if (!cnn) continue;

    const dayOfWeek = parseDay(record.weekday || record.day);
    const startTime = parseTime(record.fromhour || record.starttime);
    const endTime = parseTime(record.tohour || record.endtime);

    if (dayOfWeek === null || !startTime || !endTime) continue;

    const side = parseSide(record.blockside || record.side);
    const weeksOfMonth = parseWeeksOfMonth(
      record.week1,
      record.week2,
      record.week3,
      record.week4
    );

    const schedule: CleaningSchedule = {
      side,
      dayOfWeek,
      startTime,
      endTime,
      weeksOfMonth,
    };

    const streetName = normalizeStreetName(
      record.streetname || record.corridor || record.fullname || ''
    );
    const fromAddress = record.from_address || '';
    const toAddress = record.to_address || '';

    let info = sweepingByCNN.get(cnn);
    if (!info) {
      info = {
        cnn,
        streetName,
        fromAddress,
        toAddress,
        schedules: [],
      };
      sweepingByCNN.set(cnn, info);
    }

    // Avoid duplicate schedules
    const isDuplicate = info.schedules.some(
      s =>
        s.side === schedule.side &&
        s.dayOfWeek === schedule.dayOfWeek &&
        s.startTime === schedule.startTime &&
        s.endTime === schedule.endTime &&
        JSON.stringify(s.weeksOfMonth) === JSON.stringify(schedule.weeksOfMonth)
    );

    if (!isDuplicate) {
      info.schedules.push(schedule);
    }
  }

  return sweepingByCNN;
}

function mergeData(
  centerlines: Map<string, CenterlineInfo>,
  sweeping: Map<string, SweepingInfo>,
  syncVersion: string
): StreetSegment[] {
  const segments: StreetSegment[] = [];
  let matchCount = 0;
  let sweepingOnlyCount = 0;

  for (const [cnn, sweepingInfo] of sweeping) {
    const centerlineInfo = centerlines.get(cnn);

    if (!centerlineInfo) {
      // No centerline geometry for this CNN - skip per user requirement
      sweepingOnlyCount++;
      continue;
    }

    matchCount++;

    // Use centerline geometry (more accurate) but sweeping schedule info
    // Store geometry as JSON string to avoid Firestore nested entity limits
    const segment: StreetSegment = {
      cnn,
      streetName: sweepingInfo.streetName || centerlineInfo.streetName,
      fromAddress: sweepingInfo.fromAddress || centerlineInfo.fromAddress,
      toAddress: sweepingInfo.toAddress || centerlineInfo.toAddress,
      geometry: JSON.stringify(centerlineInfo.geometry),
      schedules: sweepingInfo.schedules,
      syncVersion,
      updatedAt: Timestamp.now(),
    };

    segments.push(segment);
  }

  console.log(`\nMerge statistics:`);
  console.log(`  - Matched (have centerline): ${matchCount}`);
  console.log(`  - Sweeping only (no centerline, dropped): ${sweepingOnlyCount}`);
  console.log(`  - Centerlines without sweeping: ${centerlines.size - matchCount}`);

  return segments;
}

async function writeToFirestore(
  segments: StreetSegment[],
  syncVersion: string
): Promise<{ success: boolean; error?: string }> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY)?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return { success: false, error: 'Firebase credentials not configured' };
  }

  // Initialize Firebase Admin if not already done
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const db = getFirestore();
  const streetSegmentsCollection = db.collection('streetSegments');
  const syncMetadataDoc = db.collection('syncMetadata').doc('latest');

  const BATCH_SIZE = 500;

  try {
    console.log(`\nWriting ${segments.length} segments to Firestore...`);

    // Write all segments in batches
    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch: WriteBatch = db.batch();
      const batchSegments = segments.slice(i, i + BATCH_SIZE);

      for (const segment of batchSegments) {
        const docRef = streetSegmentsCollection.doc(segment.cnn);
        batch.set(docRef, segment);
      }

      await batch.commit();
      const progress = Math.min(i + BATCH_SIZE, segments.length);
      console.log(`  Written ${progress}/${segments.length} segments`);
    }

    // Success! Update metadata and clean up old versions
    console.log(`\nSync successful. Cleaning up old data...`);

    // Get old version documents and delete them
    const oldDocsSnapshot = await streetSegmentsCollection
      .where('syncVersion', '!=', syncVersion)
      .limit(500)
      .get();

    let deletedCount = 0;
    while (oldDocsSnapshot.size > 0 || deletedCount === 0) {
      const snapshot = await streetSegmentsCollection
        .where('syncVersion', '!=', syncVersion)
        .limit(500)
        .get();

      if (snapshot.empty) break;

      const deleteBatch = db.batch();
      for (const doc of snapshot.docs) {
        deleteBatch.delete(doc.ref);
      }
      await deleteBatch.commit();
      deletedCount += snapshot.size;
      console.log(`  Deleted ${deletedCount} old documents...`);
    }

    // Update sync metadata
    await syncMetadataDoc.set({
      currentVersion: syncVersion,
      completedAt: Timestamp.now(),
      stats: {
        segmentsMerged: segments.length,
        deletedOldDocs: deletedCount,
      },
      status: 'success',
    });

    console.log(`\nSync complete!`);
    return { success: true };
  } catch (error) {
    console.error(`\nSync failed:`, error);

    // Rollback: delete documents with the new syncVersion
    console.log(`Rolling back...`);
    try {
      let rolledBack = 0;
      let hasMore = true;
      while (hasMore) {
        const snapshot = await streetSegmentsCollection
          .where('syncVersion', '==', syncVersion)
          .limit(500)
          .get();

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        const rollbackBatch = db.batch();
        for (const doc of snapshot.docs) {
          rollbackBatch.delete(doc.ref);
        }
        await rollbackBatch.commit();
        rolledBack += snapshot.size;
        console.log(`  Rolled back ${rolledBack} documents...`);
      }
      console.log(`Rollback complete.`);
    } catch (rollbackError) {
      console.error(`Rollback failed:`, rollbackError);
    }

    // Update metadata to indicate failure
    await syncMetadataDoc.set({
      currentVersion: syncVersion,
      completedAt: Timestamp.now(),
      stats: {},
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { merge: true });

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main(): Promise<void> {
  console.log('DataSF Street Sweeping Sync');
  console.log('===========================\n');

  const syncVersion = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`Sync version: ${syncVersion}\n`);

  // Step 1: Fetch data from both APIs
  console.log('Step 1: Fetching data from DataSF...\n');

  let sweepingRecords: RawSweepingRecord[];
  let centerlineRecords: RawCenterlineRecord[];

  try {
    [sweepingRecords, centerlineRecords] = await Promise.all([
      fetchSweepingData(),
      fetchCenterlinesData(),
    ]);
  } catch (error) {
    console.error('Failed to fetch data from DataSF:', error);
    process.exit(1);
  }

  console.log(`\nFetched:`);
  console.log(`  - ${sweepingRecords.length} sweeping records`);
  console.log(`  - ${centerlineRecords.length} centerline records`);

  // Step 2: Process and merge data
  console.log('\nStep 2: Processing and merging data...\n');

  const centerlines = processCenterlines(centerlineRecords);
  console.log(`Processed ${centerlines.size} unique centerlines`);

  const sweeping = processSweepingData(sweepingRecords);
  console.log(`Processed ${sweeping.size} unique sweeping CNNs`);

  const segments = mergeData(centerlines, sweeping, syncVersion);
  console.log(`\nMerged into ${segments.length} street segments`);

  if (segments.length === 0) {
    console.error('\nNo segments to write. Aborting.');
    process.exit(1);
  }

  // Step 3: Write to Firestore
  console.log('\nStep 3: Writing to Firestore...\n');

  const result = await writeToFirestore(segments, syncVersion);

  if (!result.success) {
    console.error(`\nSync failed: ${result.error}`);
    process.exit(1);
  }

  console.log('\nSync completed successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
