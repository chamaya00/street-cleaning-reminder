/**
 * DataSF API Client
 *
 * Fetches street sweeping data directly from San Francisco's Open Data portal.
 * This runs client-side (in the browser) to avoid proxy restrictions that may
 * exist in server environments.
 *
 * Data source: https://data.sfgov.org/City-Infrastructure/Street-Sweeping-Schedule/yhqp-riqs
 */

import type { BlockWithId, CleaningSchedule } from './types';

// DataSF Socrata API endpoint for street sweeping schedule
const DATASF_STREET_SWEEPING_URL = 'https://data.sfgov.org/resource/yhqp-riqs.json';

// Marina district approximate bounding box (lat/lng)
const MARINA_BOUNDS = {
  minLat: 37.7975,
  maxLat: 37.8065,
  minLng: -122.4500,
  maxLng: -122.4200,
};

// Marina street names for filtering
const MARINA_STREETS = [
  'beach st',
  'north point st',
  'bay st',
  'francisco st',
  'chestnut st',
  'lombard st',
  'greenwich st',
  'filbert st',
  'union st',
  'green st',
  'vallejo st',
  'broadway',
  'pacific ave',
  'marina blvd',
  'jefferson st',
  // Cross streets
  'scott st',
  'divisadero st',
  'broderick st',
  'baker st',
  'lyon st',
  'presidio blvd',
  'palace dr',
  'avila st',
  'capra way',
  'cervantes blvd',
  'mallorca way',
  'alhambra st',
  'pierce st',
  'steiner st',
  'fillmore st',
  'webster st',
  'buchanan st',
  'laguna st',
  'octavia st',
  'gough st',
  'franklin st',
  'van ness ave',
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
  // Alternative field names used in some responses
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

  return null;
}

function parseFrequency(
  week1?: string,
  week2?: string,
  week3?: string,
  week4?: string
): CleaningSchedule['frequency'] {
  const w1 = week1?.toLowerCase() === 'y' || week1 === '1';
  const w2 = week2?.toLowerCase() === 'y' || week2 === '1';
  const w3 = week3?.toLowerCase() === 'y' || week3 === '1';
  const w4 = week4?.toLowerCase() === 'y' || week4 === '1';

  if (w1 && w2 && w3 && w4) return 'weekly';
  if (w1 && !w2 && w3 && !w4) return '1st_3rd';
  if (!w1 && w2 && !w3 && w4) return '2nd_4th';
  if (w1 && !w2 && !w3 && !w4) return '1st';
  if (!w1 && w2 && !w3 && !w4) return '2nd';
  if (!w1 && !w2 && w3 && !w4) return '3rd';
  if (!w1 && !w2 && !w3 && w4) return '4th';

  return 'weekly';
}

function parseBlockNumber(fromAddr?: string, limits?: string): number {
  if (fromAddr) {
    const match = fromAddr.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      return Math.floor(num / 100) * 100;
    }
  }

  if (limits) {
    const addrMatch = limits.match(/(\d+)/);
    if (addrMatch) {
      const num = parseInt(addrMatch[1]);
      return Math.floor(num / 100) * 100;
    }
  }

  return 0;
}

function normalizeStreetName(name: string | undefined): string {
  if (!name) return '';

  return name
    .trim()
    .replace(/^(N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+/i, '')
    .replace(/\bSTREET\b/i, 'St')
    .replace(/\bAVENUE\b/i, 'Ave')
    .replace(/\bBOULEVARD\b/i, 'Blvd')
    .replace(/\bDRIVE\b/i, 'Dr')
    .replace(/\bWAY\b/i, 'Way')
    .replace(/\bPLACE\b/i, 'Pl')
    .replace(/\bCOURT\b/i, 'Ct')
    .replace(/\bLANE\b/i, 'Ln')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isMarinaStreet(streetName: string): boolean {
  const normalized = streetName.toLowerCase();
  return MARINA_STREETS.some(
    (s) => normalized.includes(s) || s.includes(normalized)
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

  if (geom.type === 'Point') {
    return checkCoord(geom.coordinates as unknown as number[]);
  } else if (geom.type === 'LineString') {
    return (geom.coordinates as unknown as number[][]).some(checkCoord);
  } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
    return (geom.coordinates as unknown as number[][][]).some((line) =>
      line.some(checkCoord)
    );
  }

  return false;
}

interface ProcessedBlock {
  streetName: string;
  blockNumber: number;
  cnn: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
  northSchedule: CleaningSchedule | null;
  southSchedule: CleaningSchedule | null;
}

function transformRecords(records: RawStreetSweepingRecord[]): Map<string, ProcessedBlock> {
  const blocks = new Map<string, ProcessedBlock>();

  for (const record of records) {
    const cnn = record.cnn || '';
    if (!cnn) continue;

    const streetName = normalizeStreetName(
      record.streetname || record.corridor || record.fullname || ''
    );
    if (!streetName) continue;

    const geom = record.the_geom || record.geometry;
    const isInMarina = isMarinaStreet(streetName) || (geom && isInMarinaBounds(geom));
    if (!isInMarina) continue;

    const blockNumber = parseBlockNumber(record.from_address, record.limits);

    const dayOfWeek = parseDay(record.weekday || record.day);
    const startTime = parseTime(record.fromhour || record.starttime);
    const endTime = parseTime(record.tohour || record.endtime);

    if (dayOfWeek === null || !startTime || !endTime) {
      continue;
    }

    const frequency = parseFrequency(
      record.week1ofmonth,
      record.week2ofmonth,
      record.week3ofmonth,
      record.week4ofmonth
    );

    const schedule: CleaningSchedule = {
      dayOfWeek,
      startTime,
      endTime,
      frequency,
    };

    const side = (record.blockside || record.side || '').toUpperCase();
    const isNorth = side.includes('N') || side.includes('NORTH');
    const isSouth = side.includes('S') || side.includes('SOUTH');

    const blockKey = cnn;

    let block = blocks.get(blockKey);
    if (!block) {
      block = {
        streetName,
        blockNumber,
        cnn,
        geometry: geom || {
          type: 'LineString',
          coordinates: [],
        },
        northSchedule: null,
        southSchedule: null,
      };
      blocks.set(blockKey, block);
    }

    if (isNorth) {
      block.northSchedule = schedule;
    } else if (isSouth) {
      block.southSchedule = schedule;
    } else {
      block.northSchedule = schedule;
      block.southSchedule = schedule;
    }
  }

  return blocks;
}

export interface DataSFResult {
  blocks: BlockWithId[];
  source: 'datasf';
  recordCount: number;
}

export interface DataSFError {
  message: string;
  code: 'FETCH_ERROR' | 'PARSE_ERROR' | 'NO_DATA' | 'TIMEOUT';
}

/**
 * Fetch street sweeping blocks from DataSF API.
 * This should be called from the client-side (browser) to avoid proxy issues.
 *
 * @param options.limit - Maximum number of records to fetch (default: 50000)
 * @param options.timeout - Request timeout in milliseconds (default: 15000)
 * @returns Promise with blocks data or error
 */
export async function fetchBlocksFromDataSF(options?: {
  limit?: number;
  timeout?: number;
}): Promise<DataSFResult> {
  const { limit = 50000, timeout = 15000 } = options || {};

  // Build the API URL with SoQL query for Marina area
  // We use a bounding box filter to reduce data transfer
  const params = new URLSearchParams({
    $limit: limit.toString(),
    $where: `within_box(the_geom, ${MARINA_BOUNDS.maxLat}, ${MARINA_BOUNDS.minLng}, ${MARINA_BOUNDS.minLat}, ${MARINA_BOUNDS.maxLng})`,
  });

  const url = `${DATASF_STREET_SWEEPING_URL}?${params}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw {
        message: `DataSF API returned ${response.status}: ${response.statusText}`,
        code: 'FETCH_ERROR',
      } as DataSFError;
    }

    const rawRecords: RawStreetSweepingRecord[] = await response.json();

    if (!rawRecords || rawRecords.length === 0) {
      throw {
        message: 'No data returned from DataSF API',
        code: 'NO_DATA',
      } as DataSFError;
    }

    // Transform records to our block format
    const blocksMap = transformRecords(rawRecords);

    if (blocksMap.size === 0) {
      throw {
        message: 'No Marina district blocks found in DataSF data',
        code: 'NO_DATA',
      } as DataSFError;
    }

    // Convert to array with IDs
    const blocks: BlockWithId[] = Array.from(blocksMap.entries()).map(
      ([id, block]) => ({
        id,
        streetName: block.streetName,
        blockNumber: block.blockNumber,
        cnn: block.cnn,
        geometry: block.geometry as BlockWithId['geometry'],
        northSchedule: block.northSchedule,
        southSchedule: block.southSchedule,
      })
    );

    return {
      blocks,
      source: 'datasf',
      recordCount: rawRecords.length,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw {
          message: 'DataSF API request timed out',
          code: 'TIMEOUT',
        } as DataSFError;
      }
      throw {
        message: error.message,
        code: 'FETCH_ERROR',
      } as DataSFError;
    }

    // Re-throw DataSFError objects
    if ((error as DataSFError).code) {
      throw error;
    }

    throw {
      message: 'Unknown error fetching from DataSF',
      code: 'FETCH_ERROR',
    } as DataSFError;
  }
}

/**
 * Check if DataSF API is accessible.
 * Useful for determining if we should attempt a live fetch.
 */
export async function isDataSFAccessible(timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${DATASF_STREET_SWEEPING_URL}?$limit=1`, {
      signal: controller.signal,
      method: 'HEAD',
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
