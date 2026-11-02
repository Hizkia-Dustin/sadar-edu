const db = require('../config/db');
const { toGeoJSONFeatureCollection } = require('../utils/geoHelper');
const { active } = require('../utils/sql');
const { httpError } = require('../middleware/errorHandler');

// Kolom sekolah + statistik terbaru (<= tahun bila diberikan)
const SELECT_SEKOLAH = `
  s.id_sekolah, s.npsn, s.id_wilayah, w.nama_wilayah, s.nama_sekolah, s.status_sekolah,
  s.alamat, s.jenjang, s.akreditasi, s.kabupaten_kota, s.kecamatan_asal, s.desa_kelurahan,
  st.tahun AS tahun_statistik,
  st.jumlah_siswa, st.jumlah_guru, st.jumlah_rombel, st.jumlah_ruang_kelas,
  st.ruang_kelas_baik, st.ruang_kelas_rusak_ringan, st.ruang_kelas_rusak_sedang, st.ruang_kelas_rusak_berat`;
// Catatan: nilai statistik yang kosong dikembalikan sebagai null (bukan 0) agar FE dapat menampilkan "-".

const joinStatistik = (tahunParam) => `
  LEFT JOIN wilayah w ON s.id_wilayah = w.id_wilayah
  LEFT JOIN LATERAL (
    SELECT x.* FROM statistik_pendidikan x
    WHERE x.id_sekolah = s.id_sekolah AND (${tahunParam}::int IS NULL OR x.tahun <= ${tahunParam}::int) AND ${active('x')}
    ORDER BY x.tahun DESC LIMIT 1
  ) st ON TRUE`;

const likeEscape = (q) => `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const getAllSekolahGeoJSON = async (req, res, next) => {
  try {
    const { jenjang, status_sekolah, id_wilayah, q, tahun } = req.query;
    const params = [tahun ? parseInt(tahun, 10) : null];
    let sql = `SELECT ${SELECT_SEKOLAH}, ST_AsGeoJSON(s.geom) AS geojson
               FROM sekolah s ${joinStatistik('$1')}
               WHERE s.geom IS NOT NULL AND ${active('s')}`;
    if (jenjang) { params.push(jenjang); sql += ` AND s.jenjang = $${params.length}`; }
    if (status_sekolah) { params.push(status_sekolah); sql += ` AND s.status_sekolah = $${params.length}`; }
    if (id_wilayah) { params.push(id_wilayah); sql += ` AND s.id_wilayah = $${params.length}`; }
    if (q) { params.push(likeEscape(q)); sql += ` AND (s.nama_sekolah ILIKE $${params.length} OR s.npsn ILIKE $${params.length})`; }
    sql += ' ORDER BY s.nama_sekolah ASC';

    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, data: toGeoJSONFeatureCollection(result.rows, 'geojson', 'id_sekolah') });
  } catch (error) {
    next(error);
  }
};

// Detail sekolah: profil, riwayat statistik, kondisi layanan di wilayahnya
const getSekolahById = async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT ${SELECT_SEKOLAH}, ST_X(s.geom) AS longitude, ST_Y(s.geom) AS latitude
       FROM sekolah s ${joinStatistik('NULL')} WHERE s.id_sekolah = $1 AND ${active('s')}`,
      [req.params.id]
    );
    if (r.rows.length === 0) throw httpError(404, 'Sekolah tidak ditemukan.');
    const sekolah = r.rows[0];

    const [riwayat, kondisi] = await Promise.all([
      db.query(
        `SELECT tahun, jumlah_siswa, jumlah_guru, jumlah_rombel, jumlah_ruang_kelas
         FROM statistik_pendidikan WHERE id_sekolah = $1 ORDER BY tahun DESC`,
        [req.params.id]
      ),
      sekolah.id_wilayah
        ? db.query(
            `SELECT p.tahun, p.skor_total, p.ranking, p.kategori_prioritas, p.diagnosis
             FROM priority_score p WHERE p.id_wilayah = $1 ORDER BY p.tahun DESC LIMIT 1`,
            [sekolah.id_wilayah]
          )
        : { rows: [] },
    ]);
    res.json({ success: true, data: { ...sekolah, riwayat_statistik: riwayat.rows, kondisi_wilayah: kondisi.rows[0] || null } });
  } catch (error) {
    next(error);
  }
};

// Alternatif sekolah terdekat (untuk orang tua / calon siswa)
const getAlternatif = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const radiusKm = Math.min(Math.max(Number(req.query.radius_km) || 5, 0.5), 50);
    const result = await db.query(
      `SELECT ${SELECT_SEKOLAH}, ST_AsGeoJSON(s.geom) AS geojson,
              ST_Distance(s.geom::geography, o.geom::geography) / 1000.0 AS jarak_km
       FROM sekolah o
       JOIN sekolah s ON s.id_sekolah <> o.id_sekolah
         AND ST_DWithin(s.geom::geography, o.geom::geography, $2::float8)
       ${joinStatistik('NULL')}
       WHERE o.id_sekolah = $1 AND s.geom IS NOT NULL AND ${active('s')}
       ORDER BY s.geom <-> o.geom
       LIMIT $3::int`,
      [req.params.id, radiusKm * 1000, limit]
    );
    res.json({ success: true, count: result.rows.length, data: toGeoJSONFeatureCollection(result.rows, 'geojson', 'id_sekolah') });
  } catch (error) {
    next(error);
  }
};

const getSekolahNearby = async (req, res, next) => {
  try {
    const { latitude, longitude, radius_km = 5 } = req.query;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'latitude dan longitude wajib berupa angka.' });
    }
    const radiusMeters = Math.min(Math.max(Number(radius_km) || 5, 0.1), 100) * 1000;
    const result = await db.query(
      `SELECT ${SELECT_SEKOLAH}, ST_AsGeoJSON(s.geom) AS geojson,
              ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000.0 AS jarak_km
       FROM sekolah s ${joinStatistik('NULL')}
       WHERE s.geom IS NOT NULL AND ${active('s')}
         AND ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3::float8)
       ORDER BY jarak_km ASC`,
      [lng, lat, radiusMeters]
    );
    res.json({ success: true, count: result.rows.length, data: toGeoJSONFeatureCollection(result.rows, 'geojson', 'id_sekolah') });
  } catch (error) {
    next(error);
  }
};

// '' / undefined / null -> NULL (data kosong), angka tetap angka
const kosongNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

const upsertStatistikRow = async (client, idSekolah, tahun, s) => {
  const r = await client.query(
    `INSERT INTO statistik_pendidikan (id_sekolah, tahun, jumlah_siswa, jumlah_guru, jumlah_rombel, jumlah_ruang_kelas)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id_sekolah, tahun) DO UPDATE
       SET jumlah_siswa = EXCLUDED.jumlah_siswa, jumlah_guru = EXCLUDED.jumlah_guru,
           jumlah_rombel = EXCLUDED.jumlah_rombel, jumlah_ruang_kelas = EXCLUDED.jumlah_ruang_kelas
     RETURNING *`,
    [idSekolah, tahun, kosongNull(s.jumlah_siswa), kosongNull(s.jumlah_guru), kosongNull(s.jumlah_rombel), kosongNull(s.jumlah_ruang_kelas)]
  );
  return r.rows[0];
};

const validCoord = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const nonNeg = (v) => v === undefined || v === null || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);

const createSekolah = async (req, res, next) => {
  try {
    const b = req.body || {};
    const lat = Number(b.latitude);
    const lng = Number(b.longitude);
    if (!b.npsn || !b.nama_sekolah) throw httpError(400, 'npsn dan nama_sekolah wajib diisi.');
    if (!validCoord(lat, lng)) throw httpError(400, 'latitude/longitude tidak valid.');
    if (![b.jumlah_siswa, b.jumlah_guru, b.jumlah_rombel, b.jumlah_ruang_kelas].every(nonNeg)) {
      throw httpError(400, 'Jumlah siswa/guru/rombel/ruang kelas tidak boleh negatif.');
    }

    const out = await db.withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO sekolah (npsn, id_wilayah, nama_sekolah, status_sekolah, alamat, jenjang, akreditasi, geom)
         VALUES ($1,
                 COALESCE($2::bigint, (SELECT w.id_wilayah FROM wilayah w
                                       WHERE w.level_wilayah = 'Kecamatan' AND ST_Covers(w.geom, ST_SetSRID(ST_MakePoint($8, $9), 4326)) LIMIT 1)),
                 $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))
         RETURNING id_sekolah, npsn, id_wilayah, nama_sekolah, status_sekolah, jenjang`,
        [String(b.npsn), b.id_wilayah || null, b.nama_sekolah, b.status_sekolah || 'Negeri', b.alamat || '',
         b.jenjang || 'SMP', b.akreditasi || null, lng, lat]
      );
      const sekolah = ins.rows[0];
      let statistik = null;
      if (b.tahun) statistik = await upsertStatistikRow(client, sekolah.id_sekolah, parseInt(b.tahun, 10), b);
      return { sekolah, statistik };
    });
    res.status(201).json({ success: true, message: 'Sekolah berhasil ditambahkan.', data: out, perlu_hitung_ulang: true });
  } catch (error) {
    next(error);
  }
};

const updateSekolah = async (req, res, next) => {
  try {
    const b = req.body || {};
    const hasCoord = b.latitude !== undefined && b.longitude !== undefined;
    if (hasCoord && !validCoord(Number(b.latitude), Number(b.longitude))) throw httpError(400, 'latitude/longitude tidak valid.');
    if (![b.jumlah_siswa, b.jumlah_guru, b.jumlah_rombel, b.jumlah_ruang_kelas].every(nonNeg)) {
      throw httpError(400, 'Jumlah siswa/guru/rombel/ruang kelas tidak boleh negatif.');
    }
    const out = await db.withTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE sekolah SET
           nama_sekolah = COALESCE($2, nama_sekolah), status_sekolah = COALESCE($3, status_sekolah),
           alamat = COALESCE($4, alamat), jenjang = COALESCE($5, jenjang), akreditasi = COALESCE($6, akreditasi),
           geom = CASE WHEN $7::float8 IS NULL THEN geom ELSE ST_SetSRID(ST_MakePoint($7::float8, $8::float8), 4326) END
         WHERE id_sekolah = $1
         RETURNING id_sekolah, npsn, nama_sekolah, status_sekolah, jenjang`,
        [req.params.id, b.nama_sekolah || null, b.status_sekolah || null, b.alamat ?? null, b.jenjang || null,
         b.akreditasi || null, hasCoord ? Number(b.longitude) : null, hasCoord ? Number(b.latitude) : null]
      );
      if (upd.rows.length === 0) throw httpError(404, 'Sekolah tidak ditemukan.');
      if (hasCoord) {
        await client.query(
          `UPDATE sekolah s SET id_wilayah = (SELECT w.id_wilayah FROM wilayah w
             WHERE w.level_wilayah = 'Kecamatan' AND ST_Covers(w.geom, s.geom) LIMIT 1) WHERE s.id_sekolah = $1`,
          [req.params.id]
        );
      }
      let statistik = null;
      if (b.tahun) statistik = await upsertStatistikRow(client, upd.rows[0].id_sekolah, parseInt(b.tahun, 10), b);
      return { sekolah: upd.rows[0], statistik };
    });
    res.json({ success: true, message: 'Sekolah diperbarui.', data: out, perlu_hitung_ulang: true });
  } catch (error) {
    next(error);
  }
};

const deleteSekolah = async (req, res, next) => {
  try {
    const r = await db.query('DELETE FROM sekolah WHERE id_sekolah = $1 RETURNING id_sekolah', [req.params.id]);
    if (r.rows.length === 0) throw httpError(404, 'Sekolah tidak ditemukan.');
    res.json({ success: true, message: 'Sekolah dihapus.', perlu_hitung_ulang: true });
  } catch (error) {
    next(error);
  }
};

const getStatistikPendidikan = async (req, res, next) => {
  try {
    const { id_sekolah, tahun } = req.query;
    const params = [];
    let sql = `SELECT st.id_statistik, st.id_sekolah, s.npsn, s.nama_sekolah, st.tahun,
                      st.jumlah_siswa, st.jumlah_guru, st.jumlah_rombel, st.jumlah_ruang_kelas
               FROM statistik_pendidikan st JOIN sekolah s ON st.id_sekolah = s.id_sekolah WHERE 1=1`;
    if (id_sekolah) { params.push(id_sekolah); sql += ` AND st.id_sekolah = $${params.length}`; }
    if (tahun) { params.push(tahun); sql += ` AND st.tahun = $${params.length}`; }
    sql += ' ORDER BY st.tahun DESC, s.nama_sekolah ASC';
    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

const createStatistikPendidikan = async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.id_sekolah || !b.tahun) throw httpError(400, 'id_sekolah dan tahun wajib diisi.');
    if (![b.jumlah_siswa, b.jumlah_guru, b.jumlah_rombel, b.jumlah_ruang_kelas].every(nonNeg)) {
      throw httpError(400, 'Nilai statistik tidak boleh negatif.');
    }
    const row = await upsertStatistikRow(db, b.id_sekolah, parseInt(b.tahun, 10), b);
    res.status(201).json({ success: true, message: 'Statistik pendidikan disimpan.', data: row, perlu_hitung_ulang: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSekolahGeoJSON, getSekolahById, getAlternatif, getSekolahNearby,
  createSekolah, updateSekolah, deleteSekolah, getStatistikPendidikan, createStatistikPendidikan,
};
