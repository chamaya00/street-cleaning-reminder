'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BlockWithId } from '@/lib/types';
import { fetchBlocksFromDataSF, type DataSFError } from '@/lib/datasf';

export type BlocksSource = 'datasf' | 'api' | 'static';

export interface UseBlocksState {
  /** The loaded blocks */
  blocks: BlockWithId[];
  /** Whether blocks are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Source of the loaded data */
  source: BlocksSource | null;
  /** Number of raw records fetched (if from DataSF) */
  recordCount: number | null;
}

export interface UseBlocksActions {
  /** Manually refresh blocks from DataSF */
  refreshFromDataSF: () => Promise<void>;
  /** Force reload from static API */
  loadFromAPI: () => Promise<void>;
}

export type UseBlocksReturn = UseBlocksState & UseBlocksActions;

/**
 * Hook for loading street blocks with DataSF fallback.
 *
 * Strategy:
 * 1. First, try to fetch fresh data from DataSF API (client-side, bypasses proxy)
 * 2. If DataSF fails, fall back to /api/blocks (server-side, uses Firestore or static data)
 *
 * @param options.preferDataSF - If true, always try DataSF first (default: true)
 * @param options.dataSFTimeout - Timeout for DataSF requests in ms (default: no timeout)
 */
export function useBlocks(options?: {
  preferDataSF?: boolean;
  dataSFTimeout?: number;
}): UseBlocksReturn {
  const { preferDataSF = true, dataSFTimeout } = options || {};

  const [blocks, setBlocks] = useState<BlockWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<BlocksSource | null>(null);
  const [recordCount, setRecordCount] = useState<number | null>(null);

  // Fetch from static API
  const loadFromAPI = useCallback(async () => {
    try {
      const response = await fetch('/api/blocks');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const loadedBlocks = data.blocks || [];

      setBlocks(loadedBlocks);
      setSource('api');
      setRecordCount(null);
      setError(null);

      return loadedBlocks;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load from API';
      throw new Error(message);
    }
  }, []);

  // Fetch from DataSF
  const refreshFromDataSF = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchBlocksFromDataSF(dataSFTimeout ? { timeout: dataSFTimeout } : undefined);

      setBlocks(result.blocks);
      setSource('datasf');
      setRecordCount(result.recordCount);
      setError(null);

      console.log(
        `[useBlocks] Loaded ${result.blocks.length} blocks from DataSF (${result.recordCount} raw records)`
      );
    } catch (dataSFError) {
      const dsError = dataSFError as DataSFError;
      console.warn(`[useBlocks] DataSF fetch failed: ${dsError.message} (${dsError.code})`);

      // Fall back to API
      try {
        await loadFromAPI();
        console.log(`[useBlocks] Fell back to API successfully`);
      } catch (apiError) {
        const message = apiError instanceof Error ? apiError.message : 'Failed to load blocks';
        setError(message);
        console.error(`[useBlocks] API fallback also failed: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [dataSFTimeout, loadFromAPI]);

  // Initial load
  useEffect(() => {
    async function initialLoad() {
      setIsLoading(true);

      if (preferDataSF) {
        // Try DataSF first, then fall back
        await refreshFromDataSF();
      } else {
        // Just use API
        try {
          await loadFromAPI();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load blocks';
          setError(message);
        } finally {
          setIsLoading(false);
        }
      }
    }

    initialLoad();
  }, [preferDataSF, refreshFromDataSF, loadFromAPI]);

  return {
    blocks,
    isLoading,
    error,
    source,
    recordCount,
    refreshFromDataSF,
    loadFromAPI,
  };
}
