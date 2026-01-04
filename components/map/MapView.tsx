'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { BlockWithId } from '@/lib/types';

import 'mapbox-gl/dist/mapbox-gl.css';

// Marina district center coordinates
const MARINA_CENTER: [number, number] = [-122.4358, 37.8006];
const DEFAULT_ZOOM = 15;

// Style constants
const UNSELECTED_COLOR = '#6B7280'; // gray-500
const SELECTED_COLOR = '#3B82F6'; // blue-500
const PENDING_ADD_COLOR = '#22C55E'; // green-500
const PENDING_REMOVE_COLOR = '#EF4444'; // red-500
const HOVER_OPACITY = 0.8;
const SELECTED_OPACITY = 0.6;
const UNSELECTED_OPACITY = 0.3;

interface MapViewProps {
  blocks: BlockWithId[];
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token is not configured');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: MARINA_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add/update block layers when map is loaded and blocks change
  useEffect(() => {
    if (!map.current || !mapLoaded || blocks.length === 0) return;

    const mapInstance = map.current;

    // Create GeoJSON feature collection
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: blocks.map((block) => ({
        type: 'Feature',
        id: block.id,
        properties: {
          id: block.id,
          streetName: block.streetName,
          blockNumber: block.blockNumber,
        },
        geometry: block.geometry,
      })),
    };

    // Add or update source
    const source = mapInstance.getSource('blocks') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else {
      mapInstance.addSource('blocks', {
        type: 'geojson',
        data: geojson,
      });

      // Add fill layer for block polygons
      mapInstance.addLayer({
        id: 'blocks-fill',
        type: 'fill',
        source: 'blocks',
        paint: {
          'fill-color': UNSELECTED_COLOR,
          'fill-opacity': UNSELECTED_OPACITY,
        },
      });

      // Add outline layer
      mapInstance.addLayer({
        id: 'blocks-outline',
        type: 'line',
        source: 'blocks',
        paint: {
          'line-color': UNSELECTED_COLOR,
          'line-width': 2,
        },
      });

      // Add click handler
      mapInstance.on('click', 'blocks-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const blockId = feature.properties?.id;
          if (blockId) {
            onBlockClick(blockId);
          }
        }
      });

      // Add hover effects
      mapInstance.on('mouseenter', 'blocks-fill', (e) => {
        mapInstance.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features.length > 0) {
          const blockId = e.features[0].properties?.id;
          if (blockId) {
            setHoveredBlockId(blockId);
          }
        }
      });

      mapInstance.on('mouseleave', 'blocks-fill', () => {
        mapInstance.getCanvas().style.cursor = '';
        setHoveredBlockId(null);
      });
    }

    // Fit bounds to all blocks
    if (blocks.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      blocks.forEach((block) => {
        if (block.geometry.type === 'Polygon') {
          block.geometry.coordinates[0].forEach((coord) => {
            bounds.extend(coord as [number, number]);
          });
        } else if (block.geometry.type === 'MultiLineString') {
          block.geometry.coordinates.forEach((line) => {
            line.forEach((coord) => {
              bounds.extend(coord as [number, number]);
            });
          });
        }
      });

      mapInstance.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16,
      });
    }
  }, [mapLoaded, blocks, onBlockClick]);

  // Update block styling based on selection state
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const mapInstance = map.current;

    // Build color expression based on block state
    const colorExpression: mapboxgl.Expression = [
      'case',
      // Pending add (selected but not saved) - green
      [
        'all',
        ['in', ['get', 'id'], ['literal', Array.from(selectedBlockIds)]],
        ['!', ['in', ['get', 'id'], ['literal', Array.from(savedBlockIds)]]],
      ],
      PENDING_ADD_COLOR,
      // Pending remove (saved but not selected) - red
      [
        'all',
        ['!', ['in', ['get', 'id'], ['literal', Array.from(selectedBlockIds)]]],
        ['in', ['get', 'id'], ['literal', Array.from(savedBlockIds)]],
      ],
      PENDING_REMOVE_COLOR,
      // Selected and saved - blue
      ['in', ['get', 'id'], ['literal', Array.from(selectedBlockIds)]],
      SELECTED_COLOR,
      // Default - gray
      UNSELECTED_COLOR,
    ];

    // Build opacity expression
    const opacityExpression: mapboxgl.Expression = [
      'case',
      // Hovered block gets higher opacity
      hoveredBlockId ? ['==', ['get', 'id'], hoveredBlockId] : false,
      HOVER_OPACITY,
      // Selected blocks
      ['in', ['get', 'id'], ['literal', Array.from(selectedBlockIds)]],
      SELECTED_OPACITY,
      // Pending remove blocks
      ['in', ['get', 'id'], ['literal', Array.from(savedBlockIds)]],
      SELECTED_OPACITY,
      // Default
      UNSELECTED_OPACITY,
    ];

    // Update layer paint properties
    if (mapInstance.getLayer('blocks-fill')) {
      mapInstance.setPaintProperty('blocks-fill', 'fill-color', colorExpression);
      mapInstance.setPaintProperty('blocks-fill', 'fill-opacity', opacityExpression);
    }

    if (mapInstance.getLayer('blocks-outline')) {
      mapInstance.setPaintProperty('blocks-outline', 'line-color', colorExpression);
    }
  }, [mapLoaded, selectedBlockIds, savedBlockIds, hoveredBlockId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />

      {/* Loading overlay */}
      {(isLoading || !mapLoaded) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {!mapLoaded ? 'Loading map...' : 'Loading blocks...'}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-medium mb-2 text-gray-700 dark:text-gray-200">Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: SELECTED_COLOR, opacity: SELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">Saved</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: PENDING_ADD_COLOR, opacity: SELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">To be added</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: PENDING_REMOVE_COLOR, opacity: SELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">To be removed</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border-2"
              style={{ borderColor: UNSELECTED_COLOR, opacity: UNSELECTED_OPACITY }}
            />
            <span className="text-gray-600 dark:text-gray-300">Unselected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
