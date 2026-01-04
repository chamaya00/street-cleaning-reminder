'use client';

import { useEffect, useState } from 'react';
import { MapView } from './MapView';
import { useMapSelection } from './useMapSelection';
import type { BlockWithId } from '@/lib/types';

interface MapPageClientProps {
  userPhone: string;
}

export function MapPageClient({ userPhone }: MapPageClientProps) {
  const [blocks, setBlocks] = useState<BlockWithId[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  const {
    selectedBlockIds,
    savedBlockIds,
    hasUnsavedChanges,
    isSaving,
    isLoading: subscriptionsLoading,
    error: selectionError,
    toggleBlock,
    discardChanges,
    saveChanges,
  } = useMapSelection();

  // Load blocks
  useEffect(() => {
    async function loadBlocks() {
      try {
        setBlocksLoading(true);
        setBlocksError(null);

        const response = await fetch('/api/blocks');
        if (!response.ok) {
          throw new Error('Failed to load blocks');
        }

        const data = await response.json();
        setBlocks(data.blocks || []);
      } catch (err) {
        console.error('Error loading blocks:', err);
        setBlocksError(err instanceof Error ? err.message : 'Failed to load blocks');
      } finally {
        setBlocksLoading(false);
      }
    }

    loadBlocks();
  }, []);

  const isLoading = blocksLoading || subscriptionsLoading;
  const error = blocksError || selectionError;

  const handleSave = async () => {
    const success = await saveChanges();
    if (success) {
      // Could show a toast notification here
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Select Your Blocks
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Signed in as {userPhone}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/notifications"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View Notifications
            </a>
            <a
              href="/api/auth/logout"
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Sign Out
            </a>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You have unsaved changes
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={discardChanges}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection count */}
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedBlockIds.size} block{selectedBlockIds.size !== 1 ? 's' : ''} selected
            {selectedBlockIds.size > 0 && (
              <span className="text-gray-400 dark:text-gray-500">
                {' '}
                &middot; Click blocks on the map to toggle selection
              </span>
            )}
            {selectedBlockIds.size === 0 && (
              <span className="text-gray-400 dark:text-gray-500">
                {' '}
                &middot; Click blocks on the map to add them
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          blocks={blocks}
          selectedBlockIds={selectedBlockIds}
          savedBlockIds={savedBlockIds}
          onBlockClick={toggleBlock}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
