'use client';

import type { SideBlockWithId } from '@/lib/types';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapContent = dynamic(() => import('./MapContent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600 dark:text-gray-300">Loading map...</span>
      </div>
    </div>
  ),
});

// Style constants
const UNSELECTED_COLOR = '#6B7280'; // gray-500
const SELECTED_COLOR = '#3B82F6'; // blue-500
const PENDING_ADD_COLOR = '#22C55E'; // green-500
const PENDING_REMOVE_COLOR = '#EF4444'; // red-500
const SELECTED_OPACITY = 0.6;
const UNSELECTED_OPACITY = 0.3;

interface MapViewProps {
  blocks: SideBlockWithId[];
  selectedBlockIds: Set<string>;
  savedBlockIds: Set<string>;
  onBlockClick: (blockId: string) => void;
  isLoading?: boolean;
}

export function MapView({
  blocks,
  selectedBlockIds,
  savedBlockIds,
  onBlockClick,
  isLoading = false,
}: MapViewProps) {
  return (
    <div className="relative w-full h-full">
      <MapContent
        blocks={blocks}
        selectedBlockIds={selectedBlockIds}
        savedBlockIds={savedBlockIds}
        onBlockClick={onBlockClick}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg z-[1000]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Loading blocks...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs z-[1000]">
        <div className="font-medium mb-2 text-gray-700 dark:text-gray-200">Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: SELECTED_COLOR, opacity: SELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">Saved</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: PENDING_ADD_COLOR, opacity: SELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">To be added</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: PENDING_REMOVE_COLOR, opacity: SELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">To be removed</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: UNSELECTED_COLOR, opacity: UNSELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">Unselected</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
          Tap each street side to select
        </div>
      </div>
    </div>
  );
}
