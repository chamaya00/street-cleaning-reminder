'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import type { BlockWithId } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

// Marina district center coordinates [lat, lng]
const MARINA_CENTER: LatLngExpression = [37.8006, -122.4358];
const DEFAULT_ZOOM = 15;

// Style constants
const UNSELECTED_COLOR = '#6B7280'; // gray-500
const SELECTED_COLOR = '#3B82F6'; // blue-500
const PENDING_ADD_COLOR = '#22C55E'; // green-500
const PENDING_REMOVE_COLOR = '#EF4444'; // red-500
const HOVER_OPACITY = 0.8;
const SELECTED_OPACITY = 0.6;
const UNSELECTED_OPACITY = 0.3;

interface MapContentProps {
  blocks: BlockWithId[];
  selectedBlockIds: Set<string>;
  savedBlockIds: Set<string>;
  onBlockClick: (blockId: string) => void;
}

// Helper to convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
function toLatLng(coords: number[]): LatLngExpression {
  return [coords[1], coords[0]];
}

// Component to fit map bounds to blocks
function FitBounds({ blocks }: { blocks: BlockWithId[] }) {
  const map = useMap();

  useEffect(() => {
    if (blocks.length === 0) return;

    const allCoords: LatLngExpression[] = [];
    blocks.forEach((block) => {
      if (block.geometry.type === 'Polygon') {
        block.geometry.coordinates[0].forEach((coord) => {
          allCoords.push(toLatLng(coord as number[]));
        });
      } else if (block.geometry.type === 'LineString') {
        block.geometry.coordinates.forEach((coord) => {
          allCoords.push(toLatLng(coord as number[]));
        });
      } else if (block.geometry.type === 'MultiLineString') {
        block.geometry.coordinates.forEach((line) => {
          line.forEach((coord) => {
            allCoords.push(toLatLng(coord as number[]));
          });
        });
      }
    });

    if (allCoords.length > 0) {
      map.fitBounds(allCoords as LatLngBoundsExpression, { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, blocks]);

  return null;
}

// Individual block component with hover state
function BlockShape({
  block,
  isSelected,
  isSaved,
  onClick,
}: {
  block: BlockWithId;
  isSelected: boolean;
  isSaved: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Determine color based on state
  let color = UNSELECTED_COLOR;
  let opacity = UNSELECTED_OPACITY;

  if (isSelected && !isSaved) {
    // Pending add - green
    color = PENDING_ADD_COLOR;
    opacity = SELECTED_OPACITY;
  } else if (!isSelected && isSaved) {
    // Pending remove - red
    color = PENDING_REMOVE_COLOR;
    opacity = SELECTED_OPACITY;
  } else if (isSelected) {
    // Selected and saved - blue
    color = SELECTED_COLOR;
    opacity = SELECTED_OPACITY;
  }

  if (isHovered) {
    opacity = HOVER_OPACITY;
  }

  const eventHandlers = {
    click: onClick,
    mouseover: () => setIsHovered(true),
    mouseout: () => setIsHovered(false),
  };

  if (block.geometry.type === 'Polygon') {
    const positions = block.geometry.coordinates[0].map((coord) =>
      toLatLng(coord as number[])
    );
    return (
      <Polygon
        positions={positions}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 2,
        }}
        eventHandlers={eventHandlers}
      />
    );
  } else if (block.geometry.type === 'LineString') {
    // For LineString (street centerlines), draw as a single polyline
    const positions = block.geometry.coordinates.map((coord) =>
      toLatLng(coord as number[])
    );
    return (
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: 6, // Thicker line for better visibility and clickability
          opacity: opacity,
          lineCap: 'round',
          lineJoin: 'round',
        }}
        eventHandlers={eventHandlers}
      />
    );
  } else if (block.geometry.type === 'MultiLineString') {
    // For MultiLineString, draw as polylines
    return (
      <>
        {block.geometry.coordinates.map((line, index) => {
          const positions = line.map((coord) => toLatLng(coord as number[]));
          return (
            <Polyline
              key={`${block.id}-${index}`}
              positions={positions}
              pathOptions={{
                color: color,
                weight: 6,
                opacity: opacity,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              eventHandlers={eventHandlers}
            />
          );
        })}
      </>
    );
  }

  return null;
}

export default function MapContent({
  blocks,
  selectedBlockIds,
  savedBlockIds,
  onBlockClick,
}: MapContentProps) {
  return (
    <MapContainer
      center={MARINA_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds blocks={blocks} />
      {blocks.map((block) => (
        <BlockShape
          key={block.id}
          block={block}
          isSelected={selectedBlockIds.has(block.id)}
          isSaved={savedBlockIds.has(block.id)}
          onClick={() => onBlockClick(block.id)}
        />
      ))}
    </MapContainer>
  );
}
