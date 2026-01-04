import type { Block, CleaningSchedule, NotificationSet, NotificationSetBlock } from './types';
import { createHash } from 'crypto';

/**
 * Represents a block with its ID for processing
 */
export interface BlockWithId extends Block {
  id: string;
}

/**
 * Represents a single side of a block with its schedule
 */
interface BlockSide {
  blockId: string;
  blockNumber: number;
  streetName: string;
  side: 'N' | 'S';
  schedule: CleaningSchedule;
}

/**
 * Key used to group blocks into notification sets
 */
interface ScheduleKey {
  streetName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  frequency: string;
}

/**
 * Generates a deterministic set key for a notification set.
 * Used to dedupe notification sets across saves.
 */
export function generateSetKey(
  userId: string,
  streetName: string,
  schedule: CleaningSchedule
): string {
  const data = `${userId}|${streetName}|${schedule.dayOfWeek}|${schedule.startTime}|${schedule.endTime}|${schedule.frequency}`;
  return createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Creates a string key for grouping blocks by schedule
 */
function createScheduleKey(key: ScheduleKey): string {
  return `${key.streetName}|${key.dayOfWeek}|${key.startTime}|${key.endTime}|${key.frequency}`;
}

/**
 * Parses a schedule key string back into its components
 */
function parseScheduleKey(keyStr: string): ScheduleKey {
  const [streetName, dayOfWeek, startTime, endTime, frequency] = keyStr.split('|');
  return {
    streetName,
    dayOfWeek: parseInt(dayOfWeek, 10),
    startTime,
    endTime,
    frequency,
  };
}

/**
 * Formats an array of block numbers into a human-readable range string.
 *
 * Examples:
 * - [2800, 2900, 3000] -> "2800-3000"
 * - [2800, 3100] -> "2800, 3100"
 * - [2800, 2900, 3100] -> "2800-2900, 3100"
 * - [2800, 2900, 3000, 3200, 3300] -> "2800-3000, 3200-3300"
 */
export function formatBlockRange(blockNumbers: number[]): string {
  if (blockNumbers.length === 0) return '';
  if (blockNumbers.length === 1) return blockNumbers[0].toString();

  // Sort block numbers
  const sorted = [...blockNumbers].sort((a, b) => a - b);

  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    // Check if this block is contiguous (100 apart is typical for SF blocks)
    if (current - previous === 100) {
      rangeEnd = current;
    } else {
      // End current range and start new one
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
      rangeStart = current;
      rangeEnd = current;
    }
  }

  // Don't forget the last range
  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

  return ranges.join(', ');
}

/**
 * Formats a blocks summary with side label.
 *
 * Examples:
 * - "2800-3000 (N side)"
 * - "2800, 3100 (S side)"
 * - "2800-3000 (both sides)"
 */
export function formatBlocksSummary(blockNumbers: number[], sideLabel: string): string {
  const range = formatBlockRange(blockNumbers);
  return `${range} (${sideLabel})`;
}

/**
 * Determines the side label based on which sides are represented.
 */
export function getSideLabel(sides: Set<'N' | 'S'>): string {
  if (sides.has('N') && sides.has('S')) {
    return 'both sides';
  } else if (sides.has('N')) {
    return 'N side';
  } else {
    return 'S side';
  }
}

/**
 * Expands blocks into individual sides with their schedules.
 * Each block can have up to 2 sides (N and S), each with its own schedule.
 */
export function expandBlocksToSides(blocks: BlockWithId[]): BlockSide[] {
  const sides: BlockSide[] = [];

  for (const block of blocks) {
    if (block.northSchedule) {
      sides.push({
        blockId: block.id,
        blockNumber: block.blockNumber,
        streetName: block.streetName,
        side: 'N',
        schedule: block.northSchedule,
      });
    }

    if (block.southSchedule) {
      sides.push({
        blockId: block.id,
        blockNumber: block.blockNumber,
        streetName: block.streetName,
        side: 'S',
        schedule: block.southSchedule,
      });
    }
  }

  return sides;
}

/**
 * Groups block sides by their schedule (streetName + dayOfWeek + startTime + endTime + frequency).
 */
export function groupBlocksBySchedule(blockSides: BlockSide[]): Map<string, BlockSide[]> {
  const groups = new Map<string, BlockSide[]>();

  for (const side of blockSides) {
    const key = createScheduleKey({
      streetName: side.streetName,
      dayOfWeek: side.schedule.dayOfWeek,
      startTime: side.schedule.startTime,
      endTime: side.schedule.endTime,
      frequency: side.schedule.frequency,
    });

    const existing = groups.get(key) || [];
    existing.push(side);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Computes notification sets from a list of subscribed blocks.
 * Groups blocks by (streetName + schedule) and creates a NotificationSet for each group.
 */
export function computeNotificationSets(
  userId: string,
  subscribedBlocks: BlockWithId[]
): Omit<NotificationSet, 'createdAt' | 'updatedAt'>[] {
  // 1. Expand blocks to individual sides
  const blockSides = expandBlocksToSides(subscribedBlocks);

  // 2. Group by schedule
  const groups = groupBlocksBySchedule(blockSides);

  // 3. Create notification sets from groups
  const notificationSets: Omit<NotificationSet, 'createdAt' | 'updatedAt'>[] = [];

  for (const [keyStr, sides] of groups) {
    const scheduleKey = parseScheduleKey(keyStr);

    // Collect unique block numbers and sides
    const blockNumbers = new Set<number>();
    const representedSides = new Set<'N' | 'S'>();
    const blocks: NotificationSetBlock[] = [];

    for (const side of sides) {
      blockNumbers.add(side.blockNumber);
      representedSides.add(side.side);
      blocks.push({
        blockId: side.blockId,
        blockNumber: side.blockNumber,
        side: side.side,
      });
    }

    // Build the schedule object
    const schedule: CleaningSchedule = {
      dayOfWeek: scheduleKey.dayOfWeek,
      startTime: scheduleKey.startTime,
      endTime: scheduleKey.endTime,
      frequency: scheduleKey.frequency as CleaningSchedule['frequency'],
    };

    // Generate deterministic key
    const setKey = generateSetKey(userId, scheduleKey.streetName, schedule);

    // Build blocks summary
    const sideLabel = getSideLabel(representedSides);
    const blocksSummary = formatBlocksSummary([...blockNumbers], sideLabel);

    notificationSets.push({
      userId,
      setKey,
      streetName: scheduleKey.streetName,
      schedule,
      blocks,
      blocksSummary,
    });
  }

  return notificationSets;
}

/**
 * Compares two notification sets to determine if they represent the same logical set.
 * Used for deduplication when updating subscriptions.
 */
export function areSetsEquivalent(
  set1: Omit<NotificationSet, 'createdAt' | 'updatedAt'>,
  set2: Omit<NotificationSet, 'createdAt' | 'updatedAt'>
): boolean {
  return set1.setKey === set2.setKey;
}
