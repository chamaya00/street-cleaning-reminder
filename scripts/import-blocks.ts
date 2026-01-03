/**
 * Import Marina district street cleaning blocks into Firestore
 *
 * Usage:
 *   npx tsx scripts/import-blocks.ts
 *
 * This script will:
 * 1. Fetch data from SF DataSF API (or load from local file if API fails)
 * 2. Filter to Marina district blocks
 * 3. Transform to Block documents
 * 4. Upload to Firestore
 *
 * Environment variables required:
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// SF DataSF Street Sweeping API endpoint
const API_URL = 'https://data.sfgov.org/resource/yhqp-riqs.json';

// Marina district approximate bounding box (lat/lng)
const MARINA_BOUNDS = {
  minLat: 37.7975,
  maxLat: 37.8065,
  minLng: -122.4500,
  maxLng: -122.4200,
};

// Marina street names for filtering
const MARINA_STREETS = [
  'Beach St',
  'North Point St',
  'Bay St',
  'Francisco St',
  'Chestnut St',
  'Lombard St',
  'Greenwich St',
  'Filbert St',
  'Union St',
  'Green St',
  'Vallejo St',
  'Broadway',
  'Pacific Ave',
  'Marina Blvd',
  'Jefferson St',
  // Cross streets
  'Scott St',
  'Divisadero St',
  'Broderick St',
  'Baker St',
  'Lyon St',
  'Presidio Blvd',
  'Palace Dr',
  'Avila St',
  'Capra Way',
  'Cervantes Blvd',
  'Mallorca Way',
  'Alhambra St',
  'Pierce St',
  'Steiner St',
  'Fillmore St',
  'Webster St',
  'Buchanan St',
  'Laguna St',
  'Octavia St',
  'Gough St',
  'Franklin St',
  'Van Ness Ave',
];

// Raw data structure from SF DataSF API
interface RawStreetSweepingRecord {
  cnn?: string;
  streetname?: string;
  corridor?: string;
  limits?: string;
  from_address?: string;
  to_address?: string;
  blockside?: string;
  weekday?: string;
  fromhour?: string;
  tohour?: string;
  week1ofmonth?: string;
  week2ofmonth?: string;
  week3ofmonth?: string;
  week4ofmonth?: string;
  week5ofmonth?: string;
  holidays?: string;
  the_geom?: {
    type: string;
    coordinates: number[][] | number[][][];
  };
  // Alternative field names
  fullname?: string;
  day?: string;
  starttime?: string;
  endtime?: string;
  side?: string;
  geometry?: {
    type: string;
    coordinates: number[][] | number[][][];
  };
}

// Our Block schema
interface CleaningSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  frequency: 'weekly' | '1st' | '2nd' | '3rd' | '4th' | '1st_3rd' | '2nd_4th';
}

interface Block {
  streetName: string;
  blockNumber: number;
  cnn: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
  northSchedule: CleaningSchedule | null;
  southSchedule: CleaningSchedule | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Day of week mapping
const DAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

function parseDay(day: string | undefined): number | null {
  if (!day) return null;
  const normalized = day.toLowerCase().trim();
  return DAY_MAP[normalized] ?? null;
}

function parseTime(time: string | undefined): string | null {
  if (!time) return null;

  // Handle various time formats
  const normalized = time.trim().toLowerCase();

  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    const [h, m] = normalized.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }

  // Just hours (e.g., "8" or "08")
  if (/^\d{1,2}$/.test(normalized)) {
    return `${normalized.padStart(2, '0')}:00`;
  }

  // AM/PM format (e.g., "8am", "8:00am", "08:00 AM")
  const ampmMatch = normalized.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const minutes = ampmMatch[2] || '00';
    const period = ampmMatch[3];

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // HHMM format (e.g., "0800")
  if (/^\d{4}$/.test(normalized)) {
    return `${normalized.slice(0, 2)}:${normalized.slice(2)}`;
  }

  console.warn(`Could not parse time: ${time}`);
  return null;
}

function parseFrequency(
  week1?: string,
  week2?: string,
  week3?: string,
  week4?: string,
  _week5?: string
): CleaningSchedule['frequency'] {
  const w1 = week1?.toLowerCase() === 'y' || week1 === '1';
  const w2 = week2?.toLowerCase() === 'y' || week2 === '1';
  const w3 = week3?.toLowerCase() === 'y' || week3 === '1';
  const w4 = week4?.toLowerCase() === 'y' || week4 === '1';

  // All weeks = weekly
  if (w1 && w2 && w3 && w4) return 'weekly';

  // 1st and 3rd
  if (w1 && !w2 && w3 && !w4) return '1st_3rd';

  // 2nd and 4th
  if (!w1 && w2 && !w3 && w4) return '2nd_4th';

  // Single weeks
  if (w1 && !w2 && !w3 && !w4) return '1st';
  if (!w1 && w2 && !w3 && !w4) return '2nd';
  if (!w1 && !w2 && w3 && !w4) return '3rd';
  if (!w1 && !w2 && !w3 && w4) return '4th';

  // Default to weekly
  return 'weekly';
}

function parseBlockNumber(fromAddr?: string, toAddr?: string, limits?: string): number {
  // Try from_address first
  if (fromAddr) {
    const match = fromAddr.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      // Round down to nearest 100
      return Math.floor(num / 100) * 100;
    }
  }

  // Try limits field (e.g., "LOMBARD ST: BAKER ST to BRODERICK ST")
  if (limits) {
    const addrMatch = limits.match(/(\d+)/);
    if (addrMatch) {
      const num = parseInt(addrMatch[1]);
      return Math.floor(num / 100) * 100;
    }
  }

  // Default to 0 if no address found
  return 0;
}

function normalizeStreetName(name: string | undefined): string {
  if (!name) return '';

  return name
    .trim()
    // Remove direction prefixes
    .replace(/^(N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+/i, '')
    // Normalize street suffixes
    .replace(/\bSTREET\b/i, 'St')
    .replace(/\bAVENUE\b/i, 'Ave')
    .replace(/\bBOULEVARD\b/i, 'Blvd')
    .replace(/\bDRIVE\b/i, 'Dr')
    .replace(/\bWAY\b/i, 'Way')
    .replace(/\bPLACE\b/i, 'Pl')
    .replace(/\bCOURT\b/i, 'Ct')
    .replace(/\bLANE\b/i, 'Ln')
    // Capitalize properly
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isMarinaStreet(streetName: string): boolean {
  const normalized = normalizeStreetName(streetName);
  return MARINA_STREETS.some(
    (s) =>
      normalized.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(normalized.toLowerCase())
  );
}

function isInMarinaBounds(geom: RawStreetSweepingRecord['the_geom']): boolean {
  if (!geom || !geom.coordinates) return false;

  const checkCoord = (coord: number[]): boolean => {
    const [lng, lat] = coord;
    return (
      lat >= MARINA_BOUNDS.minLat &&
      lat <= MARINA_BOUNDS.maxLat &&
      lng >= MARINA_BOUNDS.minLng &&
      lng <= MARINA_BOUNDS.maxLng
    );
  };

  // Check based on geometry type
  if (geom.type === 'Point') {
    return checkCoord(geom.coordinates as unknown as number[]);
  } else if (geom.type === 'LineString') {
    return (geom.coordinates as unknown as number[][]).some(checkCoord);
  } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
    return (geom.coordinates as unknown as number[][][]).some((line) => line.some(checkCoord));
  }

  return false;
}

async function fetchFromAPI(): Promise<RawStreetSweepingRecord[]> {
  console.log('Fetching data from SF DataSF API...');

  const response = await fetch(`${API_URL}?$limit=50000`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function loadFromFile(filePath: string): RawStreetSweepingRecord[] {
  console.log(`Loading data from file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function transformRecords(
  records: RawStreetSweepingRecord[]
): Map<string, Block> {
  const blocks = new Map<string, Block>();

  for (const record of records) {
    // Get CNN (unique segment ID)
    const cnn = record.cnn || '';
    if (!cnn) continue;

    // Get street name
    const streetName = normalizeStreetName(
      record.streetname || record.corridor || record.fullname || ''
    );
    if (!streetName) continue;

    // Check if Marina district
    const geom = record.the_geom || record.geometry;
    const isInMarina = isMarinaStreet(streetName) || (geom && isInMarinaBounds(geom));
    if (!isInMarina) continue;

    // Get block number
    const blockNumber = parseBlockNumber(
      record.from_address,
      record.to_address,
      record.limits
    );

    // Get schedule info
    const dayOfWeek = parseDay(record.weekday || record.day || record.fullname);
    const startTime = parseTime(record.fromhour || record.starttime);
    const endTime = parseTime(record.tohour || record.endtime);

    if (dayOfWeek === null || !startTime || !endTime) {
      console.warn(`Skipping record with invalid schedule: CNN=${cnn}`);
      continue;
    }

    const frequency = parseFrequency(
      record.week1ofmonth,
      record.week2ofmonth,
      record.week3ofmonth,
      record.week4ofmonth,
      record.week5ofmonth
    );

    const schedule: CleaningSchedule = {
      dayOfWeek,
      startTime,
      endTime,
      frequency,
    };

    // Determine block side
    const side = (record.blockside || record.side || '').toUpperCase();
    const isNorth = side.includes('N') || side.includes('NORTH');
    const isSouth = side.includes('S') || side.includes('SOUTH');

    // Create block key (CNN is unique per segment)
    const blockKey = cnn;

    // Get or create block
    let block = blocks.get(blockKey);
    if (!block) {
      block = {
        streetName,
        blockNumber,
        cnn,
        geometry: geom || {
          type: 'Polygon',
          coordinates: [],
        },
        northSchedule: null,
        southSchedule: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      blocks.set(blockKey, block);
    }

    // Assign schedule to appropriate side
    if (isNorth) {
      block.northSchedule = schedule;
    } else if (isSouth) {
      block.southSchedule = schedule;
    } else {
      // If no side specified, assign to both
      block.northSchedule = schedule;
      block.southSchedule = schedule;
    }
  }

  return blocks;
}

async function uploadToFirestore(blocks: Map<string, Block>): Promise<void> {
  console.log('Initializing Firebase Admin...');

  // Check for required environment variables
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.log('Firebase credentials not found. Outputting blocks to file instead...');

    const outputPath = path.join(process.cwd(), 'scripts', 'marina-blocks.json');
    const blocksArray = Array.from(blocks.entries()).map(([id, block]) => ({
      id,
      ...block,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    fs.writeFileSync(outputPath, JSON.stringify(blocksArray, null, 2));
    console.log(`Wrote ${blocksArray.length} blocks to ${outputPath}`);
    return;
  }

  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  const db = getFirestore(app);
  const blocksCollection = db.collection('blocks');

  console.log(`Uploading ${blocks.size} blocks to Firestore...`);

  // Use batched writes
  const BATCH_SIZE = 500;
  const entries = Array.from(blocks.entries());

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchEntries = entries.slice(i, i + BATCH_SIZE);

    for (const [id, block] of batchEntries) {
      const docRef = blocksCollection.doc(id);
      batch.set(docRef, block);
    }

    await batch.commit();
    console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}`);
  }

  console.log('Upload complete!');
}

async function main(): Promise<void> {
  console.log('SF Street Cleaning Block Import Script');
  console.log('=====================================\n');

  let records: RawStreetSweepingRecord[];

  // Try to load from local file first
  const localFilePath = path.join(process.cwd(), 'scripts', 'street-sweeping-data.json');
  if (fs.existsSync(localFilePath)) {
    records = loadFromFile(localFilePath);
  } else {
    try {
      records = await fetchFromAPI();
      // Save to local file for future use
      fs.writeFileSync(localFilePath, JSON.stringify(records, null, 2));
      console.log(`Saved ${records.length} records to ${localFilePath}`);
    } catch (error) {
      console.error('Failed to fetch from API:', error);
      console.log('\nTo import data manually:');
      console.log('1. Download data from https://data.sfgov.org/resource/yhqp-riqs.json?$limit=50000');
      console.log('2. Save to scripts/street-sweeping-data.json');
      console.log('3. Run this script again');
      process.exit(1);
    }
  }

  console.log(`\nLoaded ${records.length} raw records`);

  // Transform and filter records
  const blocks = transformRecords(records);
  console.log(`\nFiltered to ${blocks.size} Marina district blocks`);

  if (blocks.size === 0) {
    console.log('\nNo Marina blocks found. Check the filtering logic.');
    process.exit(1);
  }

  // Show sample blocks
  console.log('\nSample blocks:');
  const sample = Array.from(blocks.values()).slice(0, 3);
  for (const block of sample) {
    console.log(`  - ${block.streetName} ${block.blockNumber}`);
    if (block.northSchedule) {
      console.log(`    N: Day ${block.northSchedule.dayOfWeek}, ${block.northSchedule.startTime}-${block.northSchedule.endTime}`);
    }
    if (block.southSchedule) {
      console.log(`    S: Day ${block.southSchedule.dayOfWeek}, ${block.southSchedule.startTime}-${block.southSchedule.endTime}`);
    }
  }

  // Upload to Firestore
  await uploadToFirestore(blocks);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
