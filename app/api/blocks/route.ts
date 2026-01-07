import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { BlockWithId, GetBlocksResponse, CleaningSchedule } from '@/lib/types';
import sampleBlocks from '@/scripts/marina-blocks.json';

// Schedule format from street segments JSON file
interface SegmentSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

// GeoJSON geometry type
interface GeoJSONGeometry {
  type: string;
  coordinates: number[][] | number[][][] | number[];
}

// Segment from JSON file
interface StreetSegment {
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  geometry: GeoJSONGeometry;
  schedules: SegmentSchedule[];
}

// JSON file structure
interface StreetSegmentsFile {
  version: string;
  generatedAt: string;
  count: number;
  segments: StreetSegment[];
}

// Cache for loaded segments
let cachedSegments: StreetSegmentsFile | null = null;
let cacheTime: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// Convert weeksOfMonth array to frequency string
function weeksToFrequency(weeks: number[]): CleaningSchedule['frequency'] {
  const sorted = [...weeks].sort();
  const key = sorted.join(',');

  if (key === '1,2,3,4') return 'weekly';
  if (key === '1,3') return '1st_3rd';
  if (key === '2,4') return '2nd_4th';
  if (key === '1') return '1st';
  if (key === '2') return '2nd';
  if (key === '3') return '3rd';
  if (key === '4') return '4th';

  return 'weekly';
}

// Parse block number from address
function parseBlockNumber(fromAddress: string): number {
  if (!fromAddress) return 0;
  const match = fromAddress.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    return Math.floor(num / 100) * 100;
  }
  return 0;
}

// Transform street segment to BlockWithId format
function transformSegmentToBlock(segment: StreetSegment): BlockWithId {
  let northSchedule: CleaningSchedule | null = null;
  let southSchedule: CleaningSchedule | null = null;

  for (const schedule of segment.schedules) {
    const cleaningSchedule: CleaningSchedule = {
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      frequency: weeksToFrequency(schedule.weeksOfMonth),
    };

    if (schedule.side === 'North' || schedule.side === 'Both') {
      northSchedule = cleaningSchedule;
    }
    if (schedule.side === 'South' || schedule.side === 'Both') {
      southSchedule = cleaningSchedule;
    }
  }

  return {
    id: segment.cnn,
    streetName: segment.streetName,
    blockNumber: parseBlockNumber(segment.fromAddress),
    cnn: segment.cnn,
    geometry: segment.geometry as BlockWithId['geometry'],
    northSchedule,
    southSchedule,
  };
}

function loadSegmentsFromFile(): StreetSegmentsFile {
  const now = Date.now();

  // Return cached data if still valid
  if (cachedSegments && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedSegments;
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'street-segments.json');

  if (!fs.existsSync(filePath)) {
    throw new Error('Street segments file not found');
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  cachedSegments = JSON.parse(fileContent) as StreetSegmentsFile;
  cacheTime = now;

  return cachedSegments;
}

function fetchBlocksFromJsonFile(): BlockWithId[] {
  const data = loadSegmentsFromFile();

  console.log(`[api/blocks] Loaded ${data.count} segments from JSON file (version: ${data.version})`);

  return data.segments.map(transformSegmentToBlock);
}

function getSampleBlocks(): BlockWithId[] {
  return sampleBlocks as BlockWithId[];
}

export async function GET(): Promise<NextResponse<GetBlocksResponse | { error: string }>> {
  try {
    const blocks = fetchBlocksFromJsonFile();
    return NextResponse.json({ blocks });
  } catch (error) {
    // Fall back to sample data if JSON file is not available
    console.log('[api/blocks] Using sample blocks data (JSON file not available):', error);
    const blocks = getSampleBlocks();
    return NextResponse.json({ blocks });
  }
}
