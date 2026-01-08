/**
 * Geometry utilities for creating offset parallel lines from street centerlines.
 * Used to render separate selectable sides for each street segment.
 */

// Offset distance in degrees (approximately 6 meters at SF latitude)
// At 37.8° latitude: 1 degree longitude ≈ 87km, 1 degree latitude ≈ 111km
// 6 meters ≈ 0.000069 degrees longitude, 0.000054 degrees latitude
// Increased for better visual separation and easier tap targeting
const OFFSET_DISTANCE = 0.000060;

type Coordinate = [number, number]; // [lng, lat] in GeoJSON format

/**
 * Calculate the perpendicular offset for a line segment.
 * Returns the unit perpendicular vector scaled by the offset distance.
 */
function getPerpendicularOffset(
  p1: Coordinate,
  p2: Coordinate,
  offsetDistance: number,
  side: 'left' | 'right'
): Coordinate {
  // Direction vector
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];

  // Length of the segment
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return [0, 0];

  // Normalize and get perpendicular (rotate 90 degrees)
  // Left perpendicular: (-dy, dx), Right perpendicular: (dy, -dx)
  const scale = offsetDistance / length;

  if (side === 'left') {
    return [-dy * scale, dx * scale];
  } else {
    return [dy * scale, -dx * scale];
  }
}

/**
 * Offset a single point based on the average perpendicular of adjacent segments.
 * This creates smooth parallel lines at corners.
 */
function offsetPoint(
  prev: Coordinate | null,
  current: Coordinate,
  next: Coordinate | null,
  offsetDistance: number,
  side: 'left' | 'right'
): Coordinate {
  let offsetX = 0;
  let offsetY = 0;
  let count = 0;

  if (prev) {
    const offset = getPerpendicularOffset(prev, current, offsetDistance, side);
    offsetX += offset[0];
    offsetY += offset[1];
    count++;
  }

  if (next) {
    const offset = getPerpendicularOffset(current, next, offsetDistance, side);
    offsetX += offset[0];
    offsetY += offset[1];
    count++;
  }

  if (count > 0) {
    offsetX /= count;
    offsetY /= count;
  }

  return [current[0] + offsetX, current[1] + offsetY];
}

/**
 * Create an offset parallel line from a LineString geometry.
 * @param coordinates - Array of [lng, lat] coordinates
 * @param side - 'left' or 'right' offset direction
 * @returns New array of offset coordinates
 */
export function offsetLineString(
  coordinates: Coordinate[],
  side: 'left' | 'right'
): Coordinate[] {
  if (coordinates.length < 2) return coordinates;

  return coordinates.map((coord, i) => {
    const prev = i > 0 ? coordinates[i - 1] : null;
    const next = i < coordinates.length - 1 ? coordinates[i + 1] : null;
    return offsetPoint(prev, coord, next, OFFSET_DISTANCE, side);
  });
}

/**
 * Create offset parallel lines for a MultiLineString geometry.
 */
export function offsetMultiLineString(
  coordinates: Coordinate[][],
  side: 'left' | 'right'
): Coordinate[][] {
  return coordinates.map(line => offsetLineString(line, side));
}

/**
 * Determine which side label corresponds to which geometric offset.
 * In San Francisco, streets generally run in a grid pattern.
 * - For E-W streets: North is typically "left", South is "right"
 * - For N-S streets: East is typically "right", West is "left"
 *
 * We use the bearing of the street to determine this.
 */
export function getSideOffset(
  coordinates: Coordinate[],
  schedulesSide: 'North' | 'South'
): 'left' | 'right' {
  if (coordinates.length < 2) return 'left';

  // Get the general bearing of the street
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  // Calculate bearing in degrees (0 = North, 90 = East)
  const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

  // For streets running roughly East-West (bearing 45-135 or 225-315):
  // - North side is on the "left" when heading East
  // - South side is on the "right" when heading East
  // For streets running roughly North-South (bearing 0-45, 135-225, or 315-360):
  // - The convention varies, but we'll use left = North/West, right = South/East

  const isEastWest = (bearing >= 45 && bearing < 135) || (bearing >= 225 && bearing < 315);

  if (isEastWest) {
    // Street runs E-W
    return schedulesSide === 'North' ? 'left' : 'right';
  } else {
    // Street runs N-S (use same convention for consistency)
    return schedulesSide === 'North' ? 'left' : 'right';
  }
}
