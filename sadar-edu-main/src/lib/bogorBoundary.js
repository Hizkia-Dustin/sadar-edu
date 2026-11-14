import boundary from "../data/bogor.geojson.json" with { type: "json" };

export const BOGOR_BOUNDARY = boundary;
const [west, south, east, north] = boundary.bbox;
export const BOGOR_BOUNDS = [[west, south], [east, north]];

function ringContains([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-12 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function isInBogor(coordinates) {
  return isInBoundary(coordinates, boundary);
}

// Filter memakai geometri asli: ID wilayah demo pada sekolah tidak cocok dengan batas baru.
export function isInBoundary(coordinates, feature) {
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return false;
  if (!feature?.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return false;
  const [x, y] = coordinates;
  if (feature.bbox) {
    const [minX, minY, maxX, maxY] = feature.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) return false;
  }
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.some(([outer, ...holes]) => ringContains(coordinates, outer) && !holes.some((hole) => ringContains(coordinates, hole)));
}
