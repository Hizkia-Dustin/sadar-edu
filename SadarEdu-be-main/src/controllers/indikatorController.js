const db = require('../config/db');
const analysis = require('../services/analysisService');
const { httpError } = require('../middleware/errorHandler');

const getAllIndikator = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM indikator ORDER BY id_indikator ASC');
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// Catatan: nilai indikator baru hanya terhitung otomatis bila kodenya dikenali mesin analisis.
const createIndikator = async (req, res, next) => {
  try {
    const { kode_indikator, nama_indikator, satuan, arah_pengaruh, bobot, kelompok, deskripsi } = req.body || {};
    if (!kode_indikator || !nama_indikator) throw httpError(400, 'kode_indikator dan nama_indikator wajib diisi.');
    if (arah_pengaruh && !['Positif', 'Negatif'].includes(arah_pengaruh)) throw httpError(400, "arah_pengaruh harus 'Positif' atau 'Negatif'.");
    const result = await db.query(
      `INSERT INTO indikator (kode_indikator, nama_indikator, satuan, arah_pengaruh, bobot, kelompok, deskripsi)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [kode_indikator, nama_indikator, satuan || null, arah_pengaruh || 'Positif', bobot ?? 0, kelompok || null, deskripsi || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Menyimpan bobot MCDA. Body: { bobot: { KODE: angka } }. Bobot dinormalkan agar berjumlah 1,
 * lalu skor/ranking dihitung ulang dari nilai mentah tersimpan (cepat, tanpa query spasial).
 */
const updateBobot = async (req, res, next) => {
  try {
    const input = (req.body || {}).bobot;
    if (!input || typeof input !== 'object') throw httpError(400, 'Body harus berisi objek "bobot" {KODE: angka}.');
    const indikator = await analysis.getIndikator();
    const known = new Set(indikator.map((i) => i.kode_indikator));
    const entries = Object.entries(input);
    const unknown = entries.filter(([k]) => !known.has(k)).map(([k]) => k);
    if (unknown.length) throw httpError(400, `Kode indikator tidak dikenal: ${unknown.join(', ')}.`);
    if (entries.some(([, v]) => !Number.isFinite(Number(v)) || Number(v) < 0)) throw httpError(400, 'Bobot harus angka >= 0.');

    const merged = Object.fromEntries(indikator.map((i) => [i.kode_indikator, input[i.kode_indikator] !== undefined ? Number(input[i.kode_indikator]) : Number(i.bobot)]));
    const total = Object.values(merged).reduce((a, b) => a + b, 0);
    if (total <= 0) throw httpError(400, 'Total bobot harus lebih dari 0.');

    await db.withTransaction(async (client) => {
      for (const [kode, w] of Object.entries(merged)) {
        await client.query('UPDATE indikator SET bobot = $2 WHERE kode_indikator = $1', [kode, Math.round((w / total) * 10000) / 10000]);
      }
    });
    const hasil = await analysis.rescore({ tahun: req.body.tahun });
    res.json({ success: true, message: 'Bobot disimpan dan skor dihitung ulang.', data: hasil });
  } catch (error) {
    next(error);
  }
};

const getPriorityScores = async (req, res, next) => {
  try {
    const { tahun, id_wilayah } = req.query;
    const params = [];
    let sql = `SELECT p.*, w.nama_wilayah, w.kode_bps FROM priority_score p JOIN wilayah w ON p.id_wilayah = w.id_wilayah WHERE 1=1`;
    if (tahun) { params.push(tahun); sql += ` AND p.tahun = $${params.length}`; }
    if (id_wilayah) { params.push(id_wilayah); sql += ` AND p.id_wilayah = $${params.length}`; }
    sql += ' ORDER BY p.ranking ASC NULLS LAST';
    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllIndikator, createIndikator, updateBobot, getPriorityScores };
