'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BlockWithId } from '@/lib/types';

export type BlocksSource = 'api' | 'cache';

export interface UseBlocksState {
  /** The loaded blocks */
  blocks: BlockWithId[];
  /** Whether blocks are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Source of the loaded data */
  source: BlocksSource | null;
}

export interface UseBlocksActions {
  /** Manually refresh blocks from API */
  refresh: () => Promise<void>;
}

export type UseBlocksReturn = UseBlocksState & UseBlocksActions;

/**
 * Hook for loading street blocks from the API.
 *
 * Data is synced from DataSF to Firestore via a scheduled GitHub Action,
 * so the API always returns fresh data from Firestore (with fallback to static data).
 */
export function useBlocks(): UseBlocksReturn {
  const [blocks, setBlocks] = useState<BlockWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<BlocksSource | null>(null);

  const loadFromAPI = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/blocks');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const loadedBlocks = data.blocks || [];

      setBlocks(loadedBlocks);
      setSource('api');
      setError(null);

      console.log(`[useBlocks] Loaded ${loadedBlocks.length} blocks from API`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load blocks';
      setError(message);
      console.error(`[useBlocks] Failed to load blocks: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFromAPI();
  }, [loadFromAPI]);

  return {
    blocks,
    isLoading,
    error,
    source,
    refresh: loadFromAPI,
  };
}
