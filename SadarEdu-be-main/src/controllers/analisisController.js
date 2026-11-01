const db = require('../config/db');
const analysis = require('../services/analysisService');
const candidates = require('../services/candidateService');
const dataset = require('../services/datasetService');

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

// Publik: peta prioritas (kategori + skor + diagnosis per kecamatan)
const prioritas = wrap(async (req, res) => {
  const data = await analysis.getPrioritasGeoJSON({ tahun: req.query.tahun, simplify: req.query.simplify });
  res.json({ success: true, count: data.features.length, data });
});

const blankSpots = wrap(async (req, res) => {
  const data = await analysis.getBlankSpotsGeoJSON({ radiusKm: req.query.radius_km });
  res.json({ success: true, count: data.features.length, data });
});

const coverage = wrap(async (req, res) => {
  const data = await analysis.getCoverageGeoJSON({ radiusKm: req.query.radius_km });
  res.json({ success: true, data });
});

const ringkasan = wrap(async (req, res) => {
  res.json({ success: true, data: await analysis.getRingkasan({ tahun: req.query.tahun }) });
});

// Staf: hitung ulang seluruh analisis (metrik spasial -> skor -> diagnosis -> rekomendasi)
const recalculate = wrap(async (req, res) => {
  const { tahun, radius_km } = req.body || {};
  const hasil = await analysis.recalculate({ tahun, radiusKm: radius_km });
  res.json({ success: true, message: 'Analisis berhasil dihitung ulang.', data: hasil });
});

// Staf: rekomendasi intervensi per wilayah
const intervensi = wrap(async (req, res) => {
  const tahun = await analysis.resolveTahun(req.query.tahun);
  const params = [tahun];
  let sql = `SELECT p.id_wilayah, w.nama_wilayah, p.skor_total, p.ranking, p.kategori_prioritas, p.diagnosis, p.metrik, p.rekomendasi
             FROM priority_score p JOIN wilayah w ON w.id_wilayah = p.id_wilayah WHERE p.tahun = $1`;
  if (req.query.id_wilayah) { params.push(req.query.id_wilayah); sql += ` AND p.id_wilayah = $${params.length}`; }
  sql += ' ORDER BY p.ranking ASC NULLS LAST';
  const r = await db.query(sql, params);
  res.json({ success: true, tahun, count: r.rows.length, data: r.rows });
});

// Staf: kesiapan data & layer pendukung
const status = wrap(async (req, res) => {
  const [data, layer] = await Promise.all([dataset.dataStatus(), candidates.layerAvailability()]);
  res.json({ success: true, data: { ...data, layer_tersedia: layer } });
});

module.exports = { prioritas, blankSpots, coverage, ringkasan, recalculate, intervensi, status };
