'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

export interface MapSelectionState {
  /** Block IDs that are saved in the database */
  savedBlockIds: Set<string>;
  /** Block IDs currently selected (including unsaved changes) */
  selectedBlockIds: Set<string>;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Error message if any operation failed */
  error: string | null;
}

export interface MapSelectionActions {
  /** Toggle a block's selection state */
  toggleBlock: (blockId: string) => void;
  /** Select multiple blocks at once */
  selectBlocks: (blockIds: string[]) => void;
  /** Deselect multiple blocks at once */
  deselectBlocks: (blockIds: string[]) => void;
  /** Discard all unsaved changes */
  discardChanges: () => void;
  /** Save current selection to the server */
  saveChanges: () => Promise<boolean>;
  /** Check if a specific block is selected */
  isBlockSelected: (blockId: string) => boolean;
  /** Check if a block is newly selected (not yet saved) */
  isBlockPendingAdd: (blockId: string) => boolean;
  /** Check if a block is pending removal */
  isBlockPendingRemove: (blockId: string) => boolean;
}

export type UseMapSelectionReturn = MapSelectionState & MapSelectionActions;

/**
 * Hook for managing map block selection state.
 * Handles loading saved subscriptions, tracking changes, and saving to the server.
 */
export function useMapSelection(): UseMapSelectionReturn {
  const [savedBlockIds, setSavedBlockIds] = useState<Set<string>>(new Set());
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved subscriptions on mount
  useEffect(() => {
    async function loadSubscriptions() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/subscriptions');
        if (!response.ok) {
          throw new Error('Failed to load subscriptions');
        }

        const data = await response.json();
        const blockIds = new Set<string>(data.blockIds || []);

        setSavedBlockIds(blockIds);
        setSelectedBlockIds(blockIds);
      } catch (err) {
        console.error('Error loading subscriptions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      } finally {
        setIsLoading(false);
      }
    }

    loadSubscriptions();
  }, []);

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (savedBlockIds.size !== selectedBlockIds.size) {
      return true;
    }
    for (const id of selectedBlockIds) {
      if (!savedBlockIds.has(id)) {
        return true;
      }
    }
    return false;
  }, [savedBlockIds, selectedBlockIds]);

  // Toggle a single block
  const toggleBlock = useCallback((blockId: string) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
    setError(null);
  }, []);

  // Select multiple blocks
  const selectBlocks = useCallback((blockIds: string[]) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      for (const id of blockIds) {
        next.add(id);
      }
      return next;
    });
    setError(null);
  }, []);

  // Deselect multiple blocks
  const deselectBlocks = useCallback((blockIds: string[]) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      for (const id of blockIds) {
        next.delete(id);
      }
      return next;
    });
    setError(null);
  }, []);

  // Discard changes
  const discardChanges = useCallback(() => {
    setSelectedBlockIds(new Set(savedBlockIds));
    setError(null);
  }, [savedBlockIds]);

  // Save changes to server
  const saveChanges = useCallback(async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/api/subscriptions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blockIds: Array.from(selectedBlockIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save subscriptions');
      }

      // Update saved state to match current selection
      setSavedBlockIds(new Set(selectedBlockIds));
      return true;
    } catch (err) {
      console.error('Error saving subscriptions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save subscriptions');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [selectedBlockIds]);

  // Check if block is selected
  const isBlockSelected = useCallback(
    (blockId: string) => selectedBlockIds.has(blockId),
    [selectedBlockIds]
  );

  // Check if block is pending add (selected but not saved)
  const isBlockPendingAdd = useCallback(
    (blockId: string) => selectedBlockIds.has(blockId) && !savedBlockIds.has(blockId),
    [selectedBlockIds, savedBlockIds]
  );

  // Check if block is pending remove (saved but not selected)
  const isBlockPendingRemove = useCallback(
    (blockId: string) => savedBlockIds.has(blockId) && !selectedBlockIds.has(blockId),
    [savedBlockIds, selectedBlockIds]
  );

  return {
    savedBlockIds,
    selectedBlockIds,
    hasUnsavedChanges,
    isSaving,
    isLoading,
    error,
    toggleBlock,
    selectBlocks,
    deselectBlocks,
    discardChanges,
    saveChanges,
    isBlockSelected,
    isBlockPendingAdd,
    isBlockPendingRemove,
  };
}
