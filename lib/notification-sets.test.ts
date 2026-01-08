import { describe, it, expect } from '@jest/globals';
import {
  formatBlockRange,
  formatBlocksSummary,
  getSideLabel,
  expandBlocksToSides,
  groupBlocksBySchedule,
  computeNotificationSets,
  generateSetKey,
} from './notification-sets';
import type { CleaningSchedule, SideBlockWithId } from './types';

describe('notification-sets', () => {
  describe('formatBlockRange', () => {
    it('returns empty string for empty array', () => {
      expect(formatBlockRange([])).toBe('');
    });

    it('returns single number for single element', () => {
      expect(formatBlockRange([2800])).toBe('2800');
    });

    it('formats contiguous blocks as a range', () => {
      expect(formatBlockRange([2800, 2900, 3000])).toBe('2800-3000');
    });

    it('lists non-contiguous blocks separately', () => {
      expect(formatBlockRange([2800, 3100])).toBe('2800, 3100');
    });

    it('combines contiguous ranges with separate blocks', () => {
      expect(formatBlockRange([2800, 2900, 3100])).toBe('2800-2900, 3100');
    });

    it('handles multiple ranges', () => {
      expect(formatBlockRange([2800, 2900, 3000, 3200, 3300])).toBe('2800-3000, 3200-3300');
    });

    it('handles unsorted input', () => {
      expect(formatBlockRange([3000, 2800, 2900])).toBe('2800-3000');
    });

    it('handles complex mixed pattern', () => {
      expect(formatBlockRange([2800, 2900, 3100, 3200, 3400])).toBe('2800-2900, 3100-3200, 3400');
    });
  });

  describe('formatBlocksSummary', () => {
    it('includes side label with range', () => {
      expect(formatBlocksSummary([2800, 2900, 3000], 'N side')).toBe('2800-3000 (N side)');
    });

    it('includes side label with separate blocks', () => {
      expect(formatBlocksSummary([2800, 3100], 'S side')).toBe('2800, 3100 (S side)');
    });

    it('handles both sides label', () => {
      expect(formatBlocksSummary([2800], 'both sides')).toBe('2800 (both sides)');
    });
  });

  describe('getSideLabel', () => {
    it('returns "N side" for north only', () => {
      expect(getSideLabel(new Set(['N']))).toBe('N side');
    });

    it('returns "S side" for south only', () => {
      expect(getSideLabel(new Set(['S']))).toBe('S side');
    });

    it('returns "both sides" for both', () => {
      expect(getSideLabel(new Set(['N', 'S']))).toBe('both sides');
    });
  });

  describe('expandBlocksToSides', () => {
    it('converts side block to BlockSide format', () => {
      const block: SideBlockWithId = {
        id: 'CNN1-N',
        streetName: 'Chestnut St',
        blockNumber: 2800,
        cnn: 'CNN1',
        side: 'N',
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
        schedule: { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' },
      };

      const sides = expandBlocksToSides([block]);
      expect(sides).toHaveLength(1);
      expect(sides[0].blockId).toBe('CNN1-N');
      expect(sides[0].side).toBe('N');
      expect(sides[0].schedule.dayOfWeek).toBe(1);
    });

    it('handles multiple side blocks', () => {
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule: { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' },
        },
        {
          id: 'CNN1-S',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'S',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule: { dayOfWeek: 2, startTime: '09:00', endTime: '11:00', frequency: 'weekly' },
        },
      ];

      const sides = expandBlocksToSides(blocks);
      expect(sides).toHaveLength(2);
      expect(sides[0].side).toBe('N');
      expect(sides[1].side).toBe('S');
    });

    it('returns empty array for empty input', () => {
      const sides = expandBlocksToSides([]);
      expect(sides).toHaveLength(0);
    });
  });

  describe('groupBlocksBySchedule', () => {
    it('groups blocks with same schedule together', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const sides = [
        { blockId: 'b1', blockNumber: 2800, streetName: 'Chestnut St', side: 'N' as const, schedule },
        { blockId: 'b2', blockNumber: 2900, streetName: 'Chestnut St', side: 'N' as const, schedule },
      ];

      const groups = groupBlocksBySchedule(sides);
      expect(groups.size).toBe(1);
      const [, groupedSides] = [...groups][0];
      expect(groupedSides).toHaveLength(2);
    });

    it('separates blocks with different schedules', () => {
      const schedule1: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const schedule2: CleaningSchedule = { dayOfWeek: 2, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const sides = [
        { blockId: 'b1', blockNumber: 2800, streetName: 'Chestnut St', side: 'N' as const, schedule: schedule1 },
        { blockId: 'b2', blockNumber: 2900, streetName: 'Chestnut St', side: 'N' as const, schedule: schedule2 },
      ];

      const groups = groupBlocksBySchedule(sides);
      expect(groups.size).toBe(2);
    });

    it('separates blocks on different streets', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const sides = [
        { blockId: 'b1', blockNumber: 2800, streetName: 'Chestnut St', side: 'N' as const, schedule },
        { blockId: 'b2', blockNumber: 2800, streetName: 'Lombard St', side: 'N' as const, schedule },
      ];

      const groups = groupBlocksBySchedule(sides);
      expect(groups.size).toBe(2);
    });
  });

  describe('generateSetKey', () => {
    it('generates consistent key for same inputs', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const key1 = generateSetKey('user1', 'Chestnut St', schedule);
      const key2 = generateSetKey('user1', 'Chestnut St', schedule);
      expect(key1).toBe(key2);
    });

    it('generates different keys for different users', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const key1 = generateSetKey('user1', 'Chestnut St', schedule);
      const key2 = generateSetKey('user2', 'Chestnut St', schedule);
      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different streets', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const key1 = generateSetKey('user1', 'Chestnut St', schedule);
      const key2 = generateSetKey('user1', 'Lombard St', schedule);
      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different schedules', () => {
      const schedule1: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const schedule2: CleaningSchedule = { dayOfWeek: 2, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const key1 = generateSetKey('user1', 'Chestnut St', schedule1);
      const key2 = generateSetKey('user1', 'Chestnut St', schedule2);
      expect(key1).not.toBe(key2);
    });

    it('generates a 16-character hex string', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const key = generateSetKey('user1', 'Chestnut St', schedule);
      expect(key).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('computeNotificationSets', () => {
    it('returns empty array for no blocks', () => {
      const sets = computeNotificationSets('user1', []);
      expect(sets).toHaveLength(0);
    });

    it('creates single set for blocks with same schedule', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
        {
          id: 'CNN2-N',
          streetName: 'Chestnut St',
          blockNumber: 2900,
          cnn: 'CNN2',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
      ];

      const sets = computeNotificationSets('user1', blocks);
      expect(sets).toHaveLength(1);
      expect(sets[0].streetName).toBe('Chestnut St');
      expect(sets[0].blocksSummary).toBe('2800-2900 (N side)');
      expect(sets[0].blocks).toHaveLength(2);
    });

    it('creates separate sets for different streets', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
        {
          id: 'CNN2-N',
          streetName: 'Lombard St',
          blockNumber: 2800,
          cnn: 'CNN2',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
      ];

      const sets = computeNotificationSets('user1', blocks);
      expect(sets).toHaveLength(2);
    });

    it('creates separate sets for different days', () => {
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule: { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' },
        },
        {
          id: 'CNN1-S',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'S',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule: { dayOfWeek: 2, startTime: '08:00', endTime: '10:00', frequency: 'weekly' },
        },
      ];

      const sets = computeNotificationSets('user1', blocks);
      expect(sets).toHaveLength(2);
    });

    it('handles blocks with both sides having same schedule', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
        {
          id: 'CNN1-S',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'S',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
      ];

      const sets = computeNotificationSets('user1', blocks);
      expect(sets).toHaveLength(1);
      expect(sets[0].blocksSummary).toBe('2800 (both sides)');
      expect(sets[0].blocks).toHaveLength(2); // Both N and S sides
    });

    it('includes correct schedule in notification set', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 3, startTime: '09:00', endTime: '11:00', frequency: '1st_3rd' };
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
      ];

      const sets = computeNotificationSets('user1', blocks);
      expect(sets[0].schedule).toEqual(schedule);
    });

    it('includes userId in notification set', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
      ];

      const sets = computeNotificationSets('user1', blocks);
      expect(sets[0].userId).toBe('user1');
    });

    it('generates deterministic setKey', () => {
      const schedule: CleaningSchedule = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', frequency: 'weekly' };
      const blocks: SideBlockWithId[] = [
        {
          id: 'CNN1-N',
          streetName: 'Chestnut St',
          blockNumber: 2800,
          cnn: 'CNN1',
          side: 'N',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
          schedule,
        },
      ];

      const sets1 = computeNotificationSets('user1', blocks);
      const sets2 = computeNotificationSets('user1', blocks);
      expect(sets1[0].setKey).toBe(sets2[0].setKey);
    });
  });
});
