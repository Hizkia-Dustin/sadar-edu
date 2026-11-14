const db = require('../config/db');
const { toGeoJSONFeatureCollection } = require('../utils/geoHelper');
const { active } = require('../utils/sql');

// Daftar wilayah (tanpa geometri) untuk dropdown/filter
const listWilayah = async (req, res, next) => {
  try {
    const { level = 'Kecamatan' } = req.query;
    const result = await db.query(
      `SELECT w.id_wilayah, w.kode_bps, w.nama_wilayah, w.level_wilayah, w.parent_id, w.luas_km2,
              ST_X(ST_PointOnSurface(w.geom)) AS lng, ST_Y(ST_PointOnSurface(w.geom)) AS lat,
              ARRAY[ST_XMin(w.geom), ST_YMin(w.geom), ST_XMax(w.geom), ST_YMax(w.geom)] AS bbox
       FROM wilayah w WHERE w.level_wilayah = $1 AND w.geom IS NOT NULL AND ${active('w')}
       ORDER BY w.nama_wilayah ASC`,
      [level]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

const getAllWilayahGeoJSON = async (req, res, next) => {
  try {
    const { level, parent_id, simplify = 0.0003 } = req.query;
    const params = [Math.max(0, Number(simplify) || 0)];
    let queryText = `
      SELECT w.id_wilayah, w.kode_bps, w.parent_id, w.nama_wilayah, w.level_wilayah, w.luas_km2,
             ST_AsGeoJSON(CASE WHEN $1::float8 > 0 THEN ST_SimplifyPreserveTopology(w.geom, $1::float8) ELSE w.geom END) AS geojson
      FROM wilayah w
      WHERE w.geom IS NOT NULL AND ${active('w')}
    `;
    if (level) {
      params.push(level);
      queryText += ` AND w.level_wilayah = $${params.length}`;
    }
    if (parent_id) {
      params.push(parent_id);
      queryText += ` AND w.parent_id = $${params.length}`;
    }
    queryText += ' ORDER BY w.nama_wilayah ASC';

    const result = await db.query(queryText, params);
    res.json({ success: true, count: result.rows.length, data: toGeoJSONFeatureCollection(result.rows, 'geojson', 'id_wilayah') });
  } catch (error) {
    next(error);
  }
};

const getWilayahById = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT w.id_wilayah, w.kode_bps, w.parent_id, w.nama_wilayah, w.level_wilayah, w.luas_km2,
              ST_AsGeoJSON(w.geom) AS geojson
       FROM wilayah w WHERE w.id_wilayah = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Wilayah tidak ditemukan.' });
    res.json({ success: true, data: toGeoJSONFeatureCollection(result.rows, 'geojson', 'id_wilayah').features[0] });
  } catch (error) {
    next(error);
  }
};

const createWilayah = async (req, res, next) => {
  try {
    const { kode_bps, parent_id, nama_wilayah, level_wilayah, luas_km2, geojson } = req.body || {};
    if (!kode_bps || !nama_wilayah || !geojson) {
      return res.status(400).json({ success: false, message: 'kode_bps, nama_wilayah, dan geojson wajib diisi.' });
    }
    const result = await db.query(
      `INSERT INTO wilayah (kode_bps, parent_id, nama_wilayah, level_wilayah, luas_km2, geom)
       VALUES ($1, $2, $3, $4, COALESCE($5, ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326)::geography) / 1000000.0),
               ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($6::text), 4326)), 3)))
       RETURNING id_wilayah, kode_bps, nama_wilayah, level_wilayah, luas_km2`,
      [kode_bps, parent_id || null, nama_wilayah, level_wilayah || 'Kecamatan', luas_km2 || null, JSON.stringify(geojson)]
    );
    res.status(201).json({ success: true, message: 'Wilayah berhasil ditambahkan.', data: result.rows[0], perlu_hitung_ulang: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { listWilayah, getAllWilayahGeoJSON, getWilayahById, createWilayah };
