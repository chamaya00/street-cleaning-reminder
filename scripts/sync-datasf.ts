/**
 * Sync DataSF Street Data to JSON File
 *
 * This script fetches street sweeping schedules and street centerlines from
 * SF Open Data, joins them by CNN, and outputs to a static JSON file.
 *
 * Usage:
 *   npx tsx scripts/sync-datasf.ts
 *
 * Output:
 *   public/data/street-segments.json
 */

import * as fs from 'fs';
import * as path from 'path';

// DataSF API endpoints - using GeoJSON format for WGS84 coordinates
// The .json endpoint returns State Plane coordinates (EPSG:2227) which don't align with web maps
// The .geojson endpoint returns WGS84 coordinates (EPSG:4326) per GeoJSON spec (RFC 7946)
const SWEEPING_API_URL = 'https://data.sfgov.org/resource/yhqp-riqs.geojson';
const CENTERLINES_API_URL = 'https://data.sfgov.org/resource/3psu-pn9h.geojson';

// Fetch limits
const SWEEPING_LIMIT = 99999;
const CENTERLINES_LIMIT = 99999;

// GeoJSON FeatureCollection types (returned by .geojson endpoint)
interface GeoJSONGeometry {
  type: string;
  coordinates: number[][] | number[][][] | number[];
}

interface GeoJSONFeature<T> {
  type: 'Feature';
  properties: T;
  geometry: GeoJSONGeometry | null;
}

interface GeoJSONFeatureCollection<T> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<T>[];
}

// Raw property types from DataSF (contained in feature.properties)
interface RawSweepingProperties {
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
}

interface RawCenterlineProperties {
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
  geometry: GeoJSONGeometry; // GeoJSON geometry object (no longer stringified)
  schedules: CleaningSchedule[];
}

interface StreetSegmentsFile {
  version: string;
  generatedAt: string;
  count: number;
  segments: StreetSegment[];
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

async function fetchSweepingData(): Promise<GeoJSONFeatureCollection<RawSweepingProperties>> {
  const url = `${SWEEPING_API_URL}?$limit=${SWEEPING_LIMIT}`;
  return fetchWithRetry<GeoJSONFeatureCollection<RawSweepingProperties>>(url);
}

async function fetchCenterlinesData(): Promise<GeoJSONFeatureCollection<RawCenterlineProperties>> {
  const url = `${CENTERLINES_API_URL}?$limit=${CENTERLINES_LIMIT}`;
  return fetchWithRetry<GeoJSONFeatureCollection<RawCenterlineProperties>>(url);
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

function processCenterlines(featureCollection: GeoJSONFeatureCollection<RawCenterlineProperties>): Map<string, CenterlineInfo> {
  const centerlines = new Map<string, CenterlineInfo>();

  for (const feature of featureCollection.features) {
    const props = feature.properties;
    const cnn = normalizeCNN(props.cnn);
    if (!cnn) continue;

    // Geometry is now at the feature level in GeoJSON format (with WGS84 coordinates)
    const geometry = feature.geometry;
    if (!geometry || !geometry.coordinates) continue;

    const streetName = normalizeStreetName(props.streetname || props.street || '');

    // Get address range from various possible fields
    const fromAddress = props.lf_fadd || props.rt_fadd || '';
    const toAddress = props.lf_toadd || props.rt_toadd || '';

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

function processSweepingData(featureCollection: GeoJSONFeatureCollection<RawSweepingProperties>): Map<string, SweepingInfo> {
  const sweepingByCNN = new Map<string, SweepingInfo>();

  for (const feature of featureCollection.features) {
    const props = feature.properties;
    // Try multiple CNN fields
    const cnn = normalizeCNN(props.cnn || props.cnnrightleft);
    if (!cnn) continue;

    const dayOfWeek = parseDay(props.weekday || props.day);
    const startTime = parseTime(props.fromhour || props.starttime);
    const endTime = parseTime(props.tohour || props.endtime);

    if (dayOfWeek === null || !startTime || !endTime) continue;

    const side = parseSide(props.blockside || props.side);
    const weeksOfMonth = parseWeeksOfMonth(
      props.week1,
      props.week2,
      props.week3,
      props.week4
    );

    const schedule: CleaningSchedule = {
      side,
      dayOfWeek,
      startTime,
      endTime,
      weeksOfMonth,
    };

    const streetName = normalizeStreetName(
      props.streetname || props.corridor || props.fullname || ''
    );
    const fromAddress = props.from_address || '';
    const toAddress = props.to_address || '';

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
  sweeping: Map<string, SweepingInfo>
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
    const segment: StreetSegment = {
      cnn,
      streetName: sweepingInfo.streetName || centerlineInfo.streetName,
      fromAddress: sweepingInfo.fromAddress || centerlineInfo.fromAddress,
      toAddress: sweepingInfo.toAddress || centerlineInfo.toAddress,
      geometry: centerlineInfo.geometry,
      schedules: sweepingInfo.schedules,
    };

    segments.push(segment);
  }

  console.log(`\nMerge statistics:`);
  console.log(`  - Matched (have centerline): ${matchCount}`);
  console.log(`  - Sweeping only (no centerline, dropped): ${sweepingOnlyCount}`);
  console.log(`  - Centerlines without sweeping: ${centerlines.size - matchCount}`);

  return segments;
}

function writeToJsonFile(
  segments: StreetSegment[],
  version: string
): { success: boolean; error?: string; filePath?: string } {
  const outputDir = path.join(process.cwd(), 'public', 'data');
  const outputPath = path.join(outputDir, 'street-segments.json');

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }

    const fileData: StreetSegmentsFile = {
      version,
      generatedAt: new Date().toISOString(),
      count: segments.length,
      segments,
    };

    console.log(`\nWriting ${segments.length} segments to ${outputPath}...`);

    fs.writeFileSync(outputPath, JSON.stringify(fileData, null, 2));

    // Calculate file size
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  File size: ${fileSizeMB} MB`);

    console.log(`\nSync complete!`);
    return { success: true, filePath: outputPath };
  } catch (error) {
    console.error(`\nFailed to write JSON file:`, error);
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

  let sweepingData: GeoJSONFeatureCollection<RawSweepingProperties>;
  let centerlinesData: GeoJSONFeatureCollection<RawCenterlineProperties>;

  try {
    [sweepingData, centerlinesData] = await Promise.all([
      fetchSweepingData(),
      fetchCenterlinesData(),
    ]);
  } catch (error) {
    console.error('Failed to fetch data from DataSF:', error);
    process.exit(1);
  }

  console.log(`\nFetched (GeoJSON format with WGS84 coordinates):`);
  console.log(`  - ${sweepingData.features.length} sweeping features`);
  console.log(`  - ${centerlinesData.features.length} centerline features`);

  // Step 2: Process and merge data
  console.log('\nStep 2: Processing and merging data...\n');

  const centerlines = processCenterlines(centerlinesData);
  console.log(`Processed ${centerlines.size} unique centerlines`);

  const sweeping = processSweepingData(sweepingData);
  console.log(`Processed ${sweeping.size} unique sweeping CNNs`);

  const segments = mergeData(centerlines, sweeping);
  console.log(`\nMerged into ${segments.length} street segments`);

  if (segments.length === 0) {
    console.error('\nNo segments to write. Aborting.');
    process.exit(1);
  }

  // Step 3: Write to JSON file
  console.log('\nStep 3: Writing to JSON file...\n');

  const result = writeToJsonFile(segments, syncVersion);

  if (!result.success) {
    console.error(`\nSync failed: ${result.error}`);
    process.exit(1);
  }

  console.log('\nSync completed successfully!');
  console.log(`Output: ${result.filePath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
