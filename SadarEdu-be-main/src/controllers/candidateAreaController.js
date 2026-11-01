const db = require('../config/db');
const { toGeoJSONFeatureCollection } = require('../utils/geoHelper');
const candidates = require('../services/candidateService');
const { httpError } = require('../middleware/errorHandler');

const STATUS_VALID = ['Rekomendasi', 'Dipertimbangkan', 'Disetujui', 'Ditolak'];

const getCandidateAreasGeoJSON = async (req, res, next) => {
  try {
    const { status_kandidat, id_wilayah, tahun } = req.query;
    const params = [];
    let sql = `SELECT c.id_candidate, c.id_wilayah, w.nama_wilayah, c.tahun, c.skor_suitability, c.status_kandidat,
                      c.luas_ha, c.detail, ST_AsGeoJSON(c.geom) AS geojson
               FROM candidate_area c LEFT JOIN wilayah w ON c.id_wilayah = w.id_wilayah WHERE 1=1`;
    if (status_kandidat) { params.push(status_kandidat); sql += ` AND c.status_kandidat = $${params.length}`; }
    if (id_wilayah) { params.push(id_wilayah); sql += ` AND c.id_wilayah = $${params.length}`; }
    if (tahun) { params.push(tahun); sql += ` AND c.tahun = $${params.length}`; }
    sql += ' ORDER BY c.skor_suitability DESC';
    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, data: toGeoJSONFeatureCollection(result.rows, 'geojson', 'id_candidate') });
  } catch (error) {
    next(error);
  }
};

const generate = async (req, res, next) => {
  try {
    const hasil = await candidates.generateCandidates(req.body || {});
    res.status(201).json({ success: true, message: 'Area kandidat berhasil dibuat.', data: hasil });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status_kandidat } = req.body || {};
    if (!STATUS_VALID.includes(status_kandidat)) throw httpError(400, `status_kandidat harus salah satu: ${STATUS_VALID.join(', ')}.`);
    const r = await db.query('UPDATE candidate_area SET status_kandidat = $2 WHERE id_candidate = $1 RETURNING id_candidate, status_kandidat', [req.params.id, status_kandidat]);
    if (r.rows.length === 0) throw httpError(404, 'Area kandidat tidak ditemukan.');
    res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const r = await db.query('DELETE FROM candidate_area WHERE id_candidate = $1 RETURNING id_candidate', [req.params.id]);
    if (r.rows.length === 0) throw httpError(404, 'Area kandidat tidak ditemukan.');
    res.json({ success: true, message: 'Area kandidat dihapus.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCandidateAreasGeoJSON, generate, updateStatus, remove, STATUS_VALID };
