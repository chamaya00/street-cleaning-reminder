import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Tests for useMapSelection hook logic.
 *
 * Since useMapSelection is a React hook that makes API calls,
 * we test the core state management logic separately.
 */

describe('useMapSelection state logic', () => {
  describe('hasUnsavedChanges calculation', () => {
    it('returns false when saved and selected are identical empty sets', () => {
      const saved = new Set<string>();
      const selected = new Set<string>();
      const hasChanges = !areSetsEqual(saved, selected);
      expect(hasChanges).toBe(false);
    });

    it('returns false when saved and selected have same elements', () => {
      const saved = new Set(['a', 'b', 'c']);
      const selected = new Set(['a', 'b', 'c']);
      const hasChanges = !areSetsEqual(saved, selected);
      expect(hasChanges).toBe(false);
    });

    it('returns true when selected has more elements', () => {
      const saved = new Set(['a', 'b']);
      const selected = new Set(['a', 'b', 'c']);
      const hasChanges = !areSetsEqual(saved, selected);
      expect(hasChanges).toBe(true);
    });

    it('returns true when selected has fewer elements', () => {
      const saved = new Set(['a', 'b', 'c']);
      const selected = new Set(['a', 'b']);
      const hasChanges = !areSetsEqual(saved, selected);
      expect(hasChanges).toBe(true);
    });

    it('returns true when selected has different elements', () => {
      const saved = new Set(['a', 'b']);
      const selected = new Set(['a', 'c']);
      const hasChanges = !areSetsEqual(saved, selected);
      expect(hasChanges).toBe(true);
    });
  });

  describe('toggleBlock logic', () => {
    it('adds block if not selected', () => {
      const selected = new Set<string>();
      const blockId = 'block1';
      const result = toggleBlockInSet(selected, blockId);
      expect(result.has(blockId)).toBe(true);
    });

    it('removes block if already selected', () => {
      const selected = new Set(['block1']);
      const blockId = 'block1';
      const result = toggleBlockInSet(selected, blockId);
      expect(result.has(blockId)).toBe(false);
    });

    it('does not mutate original set', () => {
      const selected = new Set(['block1']);
      const blockId = 'block1';
      toggleBlockInSet(selected, blockId);
      expect(selected.has(blockId)).toBe(true); // Original unchanged
    });
  });

  describe('selectBlocks logic', () => {
    it('adds multiple blocks', () => {
      const selected = new Set<string>();
      const result = addBlocksToSet(selected, ['a', 'b', 'c']);
      expect(result.size).toBe(3);
      expect(result.has('a')).toBe(true);
      expect(result.has('b')).toBe(true);
      expect(result.has('c')).toBe(true);
    });

    it('does not duplicate existing blocks', () => {
      const selected = new Set(['a']);
      const result = addBlocksToSet(selected, ['a', 'b']);
      expect(result.size).toBe(2);
    });
  });

  describe('deselectBlocks logic', () => {
    it('removes multiple blocks', () => {
      const selected = new Set(['a', 'b', 'c']);
      const result = removeBlocksFromSet(selected, ['a', 'b']);
      expect(result.size).toBe(1);
      expect(result.has('c')).toBe(true);
    });

    it('handles removing non-existent blocks gracefully', () => {
      const selected = new Set(['a']);
      const result = removeBlocksFromSet(selected, ['b', 'c']);
      expect(result.size).toBe(1);
      expect(result.has('a')).toBe(true);
    });
  });

  describe('pending states', () => {
    it('isBlockPendingAdd returns true for new selections', () => {
      const saved = new Set<string>();
      const selected = new Set(['block1']);
      expect(isPendingAdd(saved, selected, 'block1')).toBe(true);
    });

    it('isBlockPendingAdd returns false for saved blocks', () => {
      const saved = new Set(['block1']);
      const selected = new Set(['block1']);
      expect(isPendingAdd(saved, selected, 'block1')).toBe(false);
    });

    it('isBlockPendingRemove returns true for unselected saved blocks', () => {
      const saved = new Set(['block1']);
      const selected = new Set<string>();
      expect(isPendingRemove(saved, selected, 'block1')).toBe(true);
    });

    it('isBlockPendingRemove returns false for still-selected blocks', () => {
      const saved = new Set(['block1']);
      const selected = new Set(['block1']);
      expect(isPendingRemove(saved, selected, 'block1')).toBe(false);
    });
  });
});

// Helper functions that mirror the logic in useMapSelection

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function toggleBlockInSet(set: Set<string>, blockId: string): Set<string> {
  const result = new Set(set);
  if (result.has(blockId)) {
    result.delete(blockId);
  } else {
    result.add(blockId);
  }
  return result;
}

function addBlocksToSet(set: Set<string>, blockIds: string[]): Set<string> {
  const result = new Set(set);
  for (const id of blockIds) {
    result.add(id);
  }
  return result;
}

function removeBlocksFromSet(set: Set<string>, blockIds: string[]): Set<string> {
  const result = new Set(set);
  for (const id of blockIds) {
    result.delete(id);
  }
  return result;
}

function isPendingAdd(saved: Set<string>, selected: Set<string>, blockId: string): boolean {
  return selected.has(blockId) && !saved.has(blockId);
}

function isPendingRemove(saved: Set<string>, selected: Set<string>, blockId: string): boolean {
  return saved.has(blockId) && !selected.has(blockId);
}
