'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapView } from './MapView';
import { Header } from '@/components/layout/Header';
import { useBlocks } from '@/hooks/useBlocks';

interface HomeMapClientProps {
  isAuthenticated: boolean;
  userPhone?: string;
  initialBlockIds?: string[];
}

export function HomeMapClient({
  isAuthenticated,
  userPhone,
  initialBlockIds = []
}: HomeMapClientProps) {
  const router = useRouter();

  // Load blocks from Firestore (synced from DataSF via scheduled job)
  const {
    blocks,
    isLoading: blocksLoading,
    error: blocksError,
    source: blocksSource,
  } = useBlocks();

  // Selection state
  const [savedBlockIds, setSavedBlockIds] = useState<Set<string>>(new Set(initialBlockIds));
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set(initialBlockIds));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Toggle block selection
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
    setSaveError(null);
  }, []);

  // Discard changes
  const discardChanges = useCallback(() => {
    setSelectedBlockIds(new Set(savedBlockIds));
    setSaveError(null);
  }, [savedBlockIds]);

  // Save changes (only for authenticated users)
  const saveChanges = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsSaving(true);
      setSaveError(null);

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

      setSavedBlockIds(new Set(selectedBlockIds));
    } catch (err) {
      console.error('Error saving subscriptions:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save subscriptions');
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, selectedBlockIds]);

  // Handle "Get Notified" button for unauthenticated users
  const handleGetNotified = () => {
    // Store selected block IDs in sessionStorage for after authentication
    if (selectedBlockIds.size > 0) {
      sessionStorage.setItem('pendingBlockIds', JSON.stringify(Array.from(selectedBlockIds)));
    }
    router.push('/notifications');
  };

  const isLoading = blocksLoading;
  const error = blocksError || saveError;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <Header isAuthenticated={isAuthenticated} userPhone={userPhone} />

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Unsaved changes banner - for authenticated users */}
      {isAuthenticated && hasUnsavedChanges && (
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
                onClick={saveChanges}
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

      {/* Selection count and action bar */}
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedBlockIds.size} street side{selectedBlockIds.size !== 1 ? 's' : ''} selected
              {selectedBlockIds.size === 0 && (
                <span className="text-gray-400 dark:text-gray-500">
                  {' '}
                  &middot; Tap street sides on the map to select
                </span>
              )}
            </p>
            {blocksSource && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                title="Data synced from SF Open Data"
              >
                SF Data
              </span>
            )}
          </div>

          {/* Get Notified button for unauthenticated users with selections */}
          {!isAuthenticated && selectedBlockIds.size > 0 && (
            <button
              onClick={handleGetNotified}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
            >
              Get Notified
            </button>
          )}
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
