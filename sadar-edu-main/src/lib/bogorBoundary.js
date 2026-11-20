import boundary from "../data/bogor.geojson.json" with { type: "json" };

export const BOGOR_BOUNDARY = boundary;
const [west, south, east, north] = boundary.bbox;

// Bounding box asli batas wilayah
export const BOGOR_BOUNDS = [[west, south], [east, north]];

// Headroom ekstra di bagian utara (+0.065) & sekelilingnya agar seluruh Kabupaten Bogor
// (termasuk Cibinong, Bojonggede, Gunung Putri, Cileungsi, Parung) terlihat utuh & nyaman tanpa terpotong
export const BOGOR_VIEW_BOUNDS = [
  [west - 0.04, south - 0.03],
  [east + 0.04, north + 0.065],
];

// Batas navigasi regional bebas agar pengguna leluasa menggeser peta tanpa mentok
export const REGIONAL_BOUNDS = [
  [106.10, -7.05],
  [107.45, -6.15],
];

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
