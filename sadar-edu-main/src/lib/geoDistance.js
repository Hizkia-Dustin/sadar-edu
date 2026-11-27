const EARTH_RADIUS_KM = 6371.0088;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Menghitung jarak garis lurus geodesik (Haversine) dalam km antara dua koordinat [lng, lat].
 */
export function haversineKm(coordA, coordB) {
  if (!Array.isArray(coordA) || !Array.isArray(coordB)) return null;
  const [lng1, lat1] = coordA;
  const [lng2, lat2] = coordB;
  if (![lng1, lat1, lng2, lat2].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;

  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLng = (lng2 - lng1) * DEG2RAD;
  const rLat1 = lat1 * DEG2RAD;
  const rLat2 = lat2 * DEG2RAD;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Format jarak ramah masyarakat Indonesia (meter jika < 1 km, km dengan 1 desimal jika >= 1 km).
 */
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return '-';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/**
 * Perkiraan waktu tempuh kasar dengan faktor kelokan jalan 1,3x.
 */
export function estimateTravelTime(km) {
  if (km == null || !Number.isFinite(km)) return '';
  const roadKm = km * 1.3;
  const motorMin = Math.max(2, Math.round((roadKm / 26) * 60));
  const walkMin = Math.max(3, Math.round((roadKm / 4.5) * 60));
  if (km <= 1.8) return `~${motorMin} mnt motor · ~${walkMin} mnt jalan`;
  return `~${motorMin} mnt motor`;
}

/**
 * Membuat GeoJSON Polygon lingkaran geodesik berjari-jari radiusKm di sekitar [lng, lat].
 */
export function createCircleGeoJSON(center, radiusKm, steps = 64) {
  if (!Array.isArray(center) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return { type: 'FeatureCollection', features: [] };
  }
  const [lng, lat] = center;
  const latRad = lat * DEG2RAD;
  const lngRad = lng * DEG2RAD;
  const angDist = radiusKm / EARTH_RADIUS_KM;
  const coords = [];

  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI;
    const pLat = Math.asin(
      Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing)
    );
    const pLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
        Math.cos(angDist) - Math.sin(latRad) * Math.sin(pLat)
      );
    coords.push([pLng * RAD2DEG, pLat * RAD2DEG]);
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { radiusKm },
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    ],
  };
}

/**
 * Menghitung bounding box [minLng, minLat, maxLng, maxLat] agar lingkaran radius tampil proporsional di peta.
 */
export function circleBounds(center, radiusKm = 3) {
  const [lng, lat] = center;
  const padKm = Math.max(radiusKm * 1.25, 1.5);
  const dLat = padKm / 111.32;
  const dLng = padKm / (111.32 * Math.max(0.2, Math.cos(lat * DEG2RAD)));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/**
 * Tautan arah rute Google Maps gratis tanpa API key tambahan.
 */
export function googleMapsDirectionsUrl(destination, origin = null) {
  if (!Array.isArray(destination)) return '#';
  const [dLng, dLat] = destination;
  const params = new URLSearchParams({ api: '1', destination: `${dLat},${dLng}` });
  if (Array.isArray(origin)) {
    const [oLng, oLat] = origin;
    params.set('origin', `${oLat},${oLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
