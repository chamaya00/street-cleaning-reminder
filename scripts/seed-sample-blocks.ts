/**
 * Seed sample Marina district blocks for development/testing
 *
 * Usage:
 *   npx tsx scripts/seed-sample-blocks.ts
 *
 * This creates a marina-blocks.json file with sample data that can be used
 * for development and testing without needing to connect to the SF DataSF API.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CleaningSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  frequency: 'weekly' | '1st' | '2nd' | '3rd' | '4th' | '1st_3rd' | '2nd_4th';
}

interface Block {
  id: string;
  streetName: string;
  blockNumber: number;
  cnn: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  northSchedule: CleaningSchedule | null;
  southSchedule: CleaningSchedule | null;
  createdAt: string;
  updatedAt: string;
}

// Marina district center coordinates
const MARINA_CENTER = {
  lat: 37.8015,
  lng: -122.4350,
};

// Street definitions with typical schedules
const MARINA_STREETS = [
  { name: 'Chestnut St', blocks: [2800, 2900, 3000, 3100, 3200], baseLat: 37.8008 },
  { name: 'Lombard St', blocks: [2800, 2900, 3000, 3100, 3200], baseLat: 37.7998 },
  { name: 'Greenwich St', blocks: [2800, 2900, 3000, 3100], baseLat: 37.7988 },
  { name: 'Filbert St', blocks: [2800, 2900, 3000], baseLat: 37.7978 },
  { name: 'Union St', blocks: [2800, 2900, 3000, 3100], baseLat: 37.7968 },
  { name: 'Marina Blvd', blocks: [100, 200, 300, 400, 500], baseLat: 37.8055 },
  { name: 'Beach St', blocks: [400, 500, 600, 700], baseLat: 37.8045 },
  { name: 'Bay St', blocks: [2000, 2100, 2200, 2300], baseLat: 37.8025 },
];

// Typical cleaning schedules
const SCHEDULES: { north: CleaningSchedule; south: CleaningSchedule }[] = [
  {
    north: { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' },
    south: { dayOfWeek: 2, startTime: '08:00', endTime: '10:00', frequency: 'weekly' },
  },
  {
    north: { dayOfWeek: 2, startTime: '09:00', endTime: '11:00', frequency: 'weekly' },
    south: { dayOfWeek: 3, startTime: '09:00', endTime: '11:00', frequency: 'weekly' },
  },
  {
    north: { dayOfWeek: 3, startTime: '08:00', endTime: '10:00', frequency: '1st_3rd' },
    south: { dayOfWeek: 4, startTime: '08:00', endTime: '10:00', frequency: '2nd_4th' },
  },
  {
    north: { dayOfWeek: 4, startTime: '10:00', endTime: '12:00', frequency: 'weekly' },
    south: { dayOfWeek: 5, startTime: '10:00', endTime: '12:00', frequency: 'weekly' },
  },
];

function createBlockGeometry(
  baseLat: number,
  baseLng: number,
  blockOffset: number
): Block['geometry'] {
  // Create a simple polygon for the block
  const latOffset = 0.0002; // ~22 meters
  const lngOffset = 0.0008 + blockOffset * 0.001; // Offset along the street

  const coords = [
    [baseLng - lngOffset, baseLat - latOffset],
    [baseLng - lngOffset + 0.0008, baseLat - latOffset],
    [baseLng - lngOffset + 0.0008, baseLat + latOffset],
    [baseLng - lngOffset, baseLat + latOffset],
    [baseLng - lngOffset, baseLat - latOffset], // Close the polygon
  ];

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}

function generateBlocks(): Block[] {
  const blocks: Block[] = [];
  let scheduleIndex = 0;

  for (const street of MARINA_STREETS) {
    for (let i = 0; i < street.blocks.length; i++) {
      const blockNumber = street.blocks[i];
      const cnn = `${street.name.replace(/\s+/g, '_')}_${blockNumber}`.toUpperCase();

      const schedule = SCHEDULES[scheduleIndex % SCHEDULES.length];
      scheduleIndex++;

      blocks.push({
        id: cnn,
        streetName: street.name,
        blockNumber,
        cnn,
        geometry: createBlockGeometry(street.baseLat, MARINA_CENTER.lng, i),
        northSchedule: schedule.north,
        southSchedule: schedule.south,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return blocks;
}

function main(): void {
  console.log('Generating sample Marina district blocks...\n');

  const blocks = generateBlocks();

  console.log(`Generated ${blocks.length} blocks:\n`);

  // Group by street for summary
  const byStreet = blocks.reduce(
    (acc, block) => {
      if (!acc[block.streetName]) acc[block.streetName] = [];
      acc[block.streetName].push(block.blockNumber);
      return acc;
    },
    {} as Record<string, number[]>
  );

  for (const [street, blockNumbers] of Object.entries(byStreet)) {
    console.log(`  ${street}: blocks ${blockNumbers.join(', ')}`);
  }

  // Write to file
  const outputPath = path.join(process.cwd(), 'scripts', 'marina-blocks.json');
  fs.writeFileSync(outputPath, JSON.stringify(blocks, null, 2));
  console.log(`\nWrote sample data to ${outputPath}`);

  console.log('\nTo upload to Firestore, configure your Firebase credentials and run:');
  console.log('  npx tsx scripts/upload-blocks.ts');
}

main();
