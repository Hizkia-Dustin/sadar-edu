/**
 * Helper untuk mengonversi hasil query PostgreSQL PostGIS ke format standar GeoJSON FeatureCollection
 */
const toGeoJSONFeatureCollection = (rows, geomColumn = 'geojson', idColumn = 'id') => {
  const features = rows.map((row) => {
    const { [geomColumn]: geometryStr, ...properties } = row;
    
    let geometry = null;
    if (geometryStr) {
      try {
        geometry = typeof geometryStr === 'string' ? JSON.parse(geometryStr) : geometryStr;
      } catch (e) {
        console.error('Error parsing GeoJSON geometry:', e);
      }
    }

    return {
      type: 'Feature',
      id: row[idColumn] || undefined,
      geometry,
      properties,
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
};

module.exports = {
  toGeoJSONFeatureCollection,
};
