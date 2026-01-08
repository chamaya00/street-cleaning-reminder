import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { SideBlockWithId, GetSideBlocksResponse, CleaningSchedule, StreetSide } from '@/lib/types';
import { offsetLineString, offsetMultiLineString, getSideOffset } from '@/lib/geometry';

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

type Coordinate = [number, number];

// Transform street segment to side-specific blocks
function transformSegmentToSideBlocks(segment: StreetSegment): SideBlockWithId[] {
  const blocks: SideBlockWithId[] = [];
  const blockNumber = parseBlockNumber(segment.fromAddress);

  // Get base coordinates from geometry
  let baseCoords: Coordinate[] = [];
  if (segment.geometry.type === 'LineString') {
    baseCoords = segment.geometry.coordinates as Coordinate[];
  } else if (segment.geometry.type === 'MultiLineString') {
    // For MultiLineString, use the first line to determine bearing
    baseCoords = (segment.geometry.coordinates as Coordinate[][])[0] || [];
  }

  // Group schedules by side
  const northSchedules: CleaningSchedule[] = [];
  const southSchedules: CleaningSchedule[] = [];

  for (const schedule of segment.schedules) {
    const cleaningSchedule: CleaningSchedule = {
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      frequency: weeksToFrequency(schedule.weeksOfMonth),
    };

    if (schedule.side === 'North' || schedule.side === 'Both') {
      northSchedules.push(cleaningSchedule);
    }
    if (schedule.side === 'South' || schedule.side === 'Both') {
      southSchedules.push(cleaningSchedule);
    }
  }

  // Create North side block if it has a schedule
  if (northSchedules.length > 0) {
    const side: StreetSide = 'N';
    const offsetSide = getSideOffset(baseCoords, 'North');

    let offsetGeometry: SideBlockWithId['geometry'];
    if (segment.geometry.type === 'LineString') {
      offsetGeometry = {
        type: 'LineString',
        coordinates: offsetLineString(segment.geometry.coordinates as Coordinate[], offsetSide),
      };
    } else if (segment.geometry.type === 'MultiLineString') {
      offsetGeometry = {
        type: 'MultiLineString',
        coordinates: offsetMultiLineString(segment.geometry.coordinates as Coordinate[][], offsetSide),
      };
    } else {
      // Skip Polygon geometries for side-specific blocks
      return blocks;
    }

    blocks.push({
      id: `${segment.cnn}-${side}`,
      streetName: segment.streetName,
      blockNumber,
      cnn: segment.cnn,
      side,
      geometry: offsetGeometry,
      schedule: northSchedules[0], // Use first schedule (they should be the same)
    });
  }

  // Create South side block if it has a schedule
  if (southSchedules.length > 0) {
    const side: StreetSide = 'S';
    const offsetSide = getSideOffset(baseCoords, 'South');

    let offsetGeometry: SideBlockWithId['geometry'];
    if (segment.geometry.type === 'LineString') {
      offsetGeometry = {
        type: 'LineString',
        coordinates: offsetLineString(segment.geometry.coordinates as Coordinate[], offsetSide),
      };
    } else if (segment.geometry.type === 'MultiLineString') {
      offsetGeometry = {
        type: 'MultiLineString',
        coordinates: offsetMultiLineString(segment.geometry.coordinates as Coordinate[][], offsetSide),
      };
    } else {
      return blocks;
    }

    blocks.push({
      id: `${segment.cnn}-${side}`,
      streetName: segment.streetName,
      blockNumber,
      cnn: segment.cnn,
      side,
      geometry: offsetGeometry,
      schedule: southSchedules[0],
    });
  }

  return blocks;
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

function fetchSideBlocksFromJsonFile(): SideBlockWithId[] {
  const data = loadSegmentsFromFile();

  console.log(`[api/blocks] Loaded ${data.count} segments from JSON file (version: ${data.version})`);

  // Transform each segment into side-specific blocks
  const allBlocks: SideBlockWithId[] = [];
  for (const segment of data.segments) {
    const sideBlocks = transformSegmentToSideBlocks(segment);
    allBlocks.push(...sideBlocks);
  }

  console.log(`[api/blocks] Created ${allBlocks.length} side-specific blocks`);

  return allBlocks;
}

export async function GET(): Promise<NextResponse<GetSideBlocksResponse | { error: string }>> {
  try {
    const blocks = fetchSideBlocksFromJsonFile();
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('[api/blocks] Error loading blocks:', error);
    return NextResponse.json({ error: 'Failed to load blocks' }, { status: 500 });
  }
}
