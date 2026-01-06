/**
 * Seed sample Marina district blocks for development/testing
 *
 * Usage:
 *   npx tsx scripts/seed-sample-blocks.ts
 *
 * This creates a marina-blocks.json file with sample data that can be used
 * for development and testing without needing to connect to the SF DataSF API.
 *
 * The geometry uses LineString format representing actual street centerlines,
 * not rectangles. This matches how real street data from DataSF would appear.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LineString, MultiLineString } from 'geojson';

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
  geometry: LineString | MultiLineString;
  northSchedule: CleaningSchedule | null;
  southSchedule: CleaningSchedule | null;
  createdAt: string;
  updatedAt: string;
}

// Real Marina district street coordinates (approximate centerlines)
// Streets run roughly east-west in this area
// Coordinates are [longitude, latitude] per GeoJSON spec

interface StreetDefinition {
  name: string;
  blocks: {
    number: number;
    // Each block is defined by start and end coordinates [lng, lat]
    // These follow the actual street path (can have multiple points for curves)
    coordinates: [number, number][];
  }[];
}

// Marina District streets with realistic coordinates
// Block numbers correspond to the 100-block addressing system
const MARINA_STREETS: StreetDefinition[] = [
  {
    name: 'Chestnut St',
    blocks: [
      {
        number: 2800,
        coordinates: [
          [-122.4350, 37.80052],
          [-122.4362, 37.80052],
        ],
      },
      {
        number: 2900,
        coordinates: [
          [-122.4362, 37.80052],
          [-122.4374, 37.80052],
        ],
      },
      {
        number: 3000,
        coordinates: [
          [-122.4374, 37.80052],
          [-122.4386, 37.80052],
        ],
      },
      {
        number: 3100,
        coordinates: [
          [-122.4386, 37.80052],
          [-122.4398, 37.80052],
        ],
      },
      {
        number: 3200,
        coordinates: [
          [-122.4398, 37.80052],
          [-122.4410, 37.80052],
        ],
      },
    ],
  },
  {
    name: 'Lombard St',
    blocks: [
      {
        number: 2800,
        coordinates: [
          [-122.4350, 37.79962],
          [-122.4362, 37.79962],
        ],
      },
      {
        number: 2900,
        coordinates: [
          [-122.4362, 37.79962],
          [-122.4374, 37.79962],
        ],
      },
      {
        number: 3000,
        coordinates: [
          [-122.4374, 37.79962],
          [-122.4386, 37.79962],
        ],
      },
      {
        number: 3100,
        coordinates: [
          [-122.4386, 37.79962],
          [-122.4398, 37.79962],
        ],
      },
      {
        number: 3200,
        coordinates: [
          [-122.4398, 37.79962],
          [-122.4410, 37.79962],
        ],
      },
    ],
  },
  {
    name: 'Greenwich St',
    blocks: [
      {
        number: 2800,
        coordinates: [
          [-122.4350, 37.79872],
          [-122.4362, 37.79872],
        ],
      },
      {
        number: 2900,
        coordinates: [
          [-122.4362, 37.79872],
          [-122.4374, 37.79872],
        ],
      },
      {
        number: 3000,
        coordinates: [
          [-122.4374, 37.79872],
          [-122.4386, 37.79872],
        ],
      },
      {
        number: 3100,
        coordinates: [
          [-122.4386, 37.79872],
          [-122.4398, 37.79872],
        ],
      },
    ],
  },
  {
    name: 'Filbert St',
    blocks: [
      {
        number: 2800,
        coordinates: [
          [-122.4350, 37.79782],
          [-122.4362, 37.79782],
        ],
      },
      {
        number: 2900,
        coordinates: [
          [-122.4362, 37.79782],
          [-122.4374, 37.79782],
        ],
      },
      {
        number: 3000,
        coordinates: [
          [-122.4374, 37.79782],
          [-122.4386, 37.79782],
        ],
      },
    ],
  },
  {
    name: 'Union St',
    blocks: [
      {
        number: 2800,
        coordinates: [
          [-122.4350, 37.79692],
          [-122.4362, 37.79692],
        ],
      },
      {
        number: 2900,
        coordinates: [
          [-122.4362, 37.79692],
          [-122.4374, 37.79692],
        ],
      },
      {
        number: 3000,
        coordinates: [
          [-122.4374, 37.79692],
          [-122.4386, 37.79692],
        ],
      },
      {
        number: 3100,
        coordinates: [
          [-122.4386, 37.79692],
          [-122.4398, 37.79692],
        ],
      },
    ],
  },
  {
    name: 'Marina Blvd',
    blocks: [
      {
        number: 100,
        coordinates: [
          [-122.4350, 37.80550],
          [-122.4362, 37.80550],
        ],
      },
      {
        number: 200,
        coordinates: [
          [-122.4362, 37.80550],
          [-122.4374, 37.80550],
        ],
      },
      {
        number: 300,
        coordinates: [
          [-122.4374, 37.80550],
          [-122.4386, 37.80550],
        ],
      },
      {
        number: 400,
        coordinates: [
          [-122.4386, 37.80550],
          [-122.4398, 37.80550],
        ],
      },
      {
        number: 500,
        coordinates: [
          [-122.4398, 37.80550],
          [-122.4410, 37.80550],
        ],
      },
    ],
  },
  {
    name: 'Beach St',
    blocks: [
      {
        number: 400,
        coordinates: [
          [-122.4350, 37.80460],
          [-122.4362, 37.80460],
        ],
      },
      {
        number: 500,
        coordinates: [
          [-122.4362, 37.80460],
          [-122.4374, 37.80460],
        ],
      },
      {
        number: 600,
        coordinates: [
          [-122.4374, 37.80460],
          [-122.4386, 37.80460],
        ],
      },
      {
        number: 700,
        coordinates: [
          [-122.4386, 37.80460],
          [-122.4398, 37.80460],
        ],
      },
    ],
  },
  {
    name: 'Bay St',
    blocks: [
      {
        number: 2000,
        coordinates: [
          [-122.4350, 37.80250],
          [-122.4362, 37.80250],
        ],
      },
      {
        number: 2100,
        coordinates: [
          [-122.4362, 37.80250],
          [-122.4374, 37.80250],
        ],
      },
      {
        number: 2200,
        coordinates: [
          [-122.4374, 37.80250],
          [-122.4386, 37.80250],
        ],
      },
      {
        number: 2300,
        coordinates: [
          [-122.4386, 37.80250],
          [-122.4398, 37.80250],
        ],
      },
    ],
  },
  // Add north-south cross streets (Avenues) with example blocks
  {
    name: 'Divisadero St',
    blocks: [
      {
        number: 2800, // Near Marina Blvd
        coordinates: [
          [-122.4398, 37.80550],
          [-122.4398, 37.80460],
        ],
      },
      {
        number: 2900, // Beach to Bay
        coordinates: [
          [-122.4398, 37.80460],
          [-122.4398, 37.80250],
        ],
      },
    ],
  },
  {
    name: 'Scott St',
    blocks: [
      {
        number: 2800, // Near Marina Blvd
        coordinates: [
          [-122.4374, 37.80550],
          [-122.4374, 37.80460],
        ],
      },
      {
        number: 2900, // Beach to Bay
        coordinates: [
          [-122.4374, 37.80460],
          [-122.4374, 37.80250],
        ],
      },
    ],
  },
  {
    name: 'Pierce St',
    blocks: [
      {
        number: 2800, // Near Marina Blvd
        coordinates: [
          [-122.4362, 37.80550],
          [-122.4362, 37.80460],
        ],
      },
      {
        number: 2900, // Beach to Bay
        coordinates: [
          [-122.4362, 37.80460],
          [-122.4362, 37.80250],
        ],
      },
    ],
  },
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

function createLineStringGeometry(coordinates: [number, number][]): LineString {
  return {
    type: 'LineString',
    coordinates: coordinates,
  };
}

function generateBlocks(): Block[] {
  const blocks: Block[] = [];
  let scheduleIndex = 0;

  for (const street of MARINA_STREETS) {
    for (const blockDef of street.blocks) {
      const cnn = `${street.name.replace(/\s+/g, '_')}_${blockDef.number}`.toUpperCase();

      const schedule = SCHEDULES[scheduleIndex % SCHEDULES.length];
      scheduleIndex++;

      blocks.push({
        id: cnn,
        streetName: street.name,
        blockNumber: blockDef.number,
        cnn,
        geometry: createLineStringGeometry(blockDef.coordinates),
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
  console.log('Generating sample Marina district blocks with LineString geometry...\n');

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

  // Show sample geometry
  console.log('\nSample geometry (LineString instead of Polygon):');
  console.log(JSON.stringify(blocks[0].geometry, null, 2));

  console.log('\nTo upload to Firestore, configure your Firebase credentials and run:');
  console.log('  npx tsx scripts/upload-blocks.ts');
}

main();
