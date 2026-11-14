const db = require('../config/db');
const cfg = require('../config/analysis');
const S = require('./scoring');
const { active } = require('../utils/sql');
const { resolveTahun } = require('./analysisService');
const { httpError } = require('../middleware/errorHandler');

/** Layer pendukung apa saja yang datanya tersedia (aktif) */
async function layerAvailability(client = db) {
  const r = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM jalan j WHERE ${active('j')}) AS jalan,
       EXISTS (SELECT 1 FROM layer_constraint c WHERE c.jenis = 'risiko_bencana' AND ${active('c')}) AS risiko_bencana,
       EXISTS (SELECT 1 FROM layer_constraint c WHERE c.jenis = 'lereng' AND ${active('c')}) AS lereng,
       EXISTS (SELECT 1 FROM layer_constraint c WHERE c.jenis = 'kawasan_lindung' AND ${active('c')}) AS kawasan_lindung`
  );
  return r.rows[0];
}

/**
 * Membuat sel grid (ukuran sel meter) di kecamatan prioritas, lalu mengambil atribut overlay
 * tiap sel: jarak ke sekolah terdekat, jarak ke jalan, level risiko, kemiringan, kawasan lindung.
 */
async function fetchCells({ tahun, idWilayah, topWilayah, cellMeters }, client = db) {
  const sql = `
    WITH target AS (
      SELECT w.id_wilayah, w.nama_wilayah, ST_MakeValid(w.geom) AS geom, COALESCE(ps.skor_total, 0) AS skor_wilayah
      FROM wilayah w
      JOIN priority_score ps ON ps.id_wilayah = w.id_wilayah AND ps.tahun = $1::int
      WHERE w.level_wilayah = 'Kecamatan' AND w.geom IS NOT NULL AND ${active('w')}
        AND ( ($2::bigint IS NOT NULL AND w.id_wilayah = $2::bigint)
           OR ($2::bigint IS NULL AND ps.ranking <= $3::int) )
    ),
    cells AS (
      SELECT t.id_wilayah, t.nama_wilayah, t.skor_wilayah, ST_Transform(g.geom, 4326) AS geom
      FROM target t
      CROSS JOIN LATERAL ST_SquareGrid($4::float8, ST_Transform(t.geom, ${cfg.UTM_SRID})) AS g
      WHERE ST_Intersects(ST_Centroid(g.geom), ST_Transform(t.geom, ${cfg.UTM_SRID}))
    )
    SELECT c.id_wilayah, c.nama_wilayah, c.skor_wilayah,
           ST_AsGeoJSON(c.geom) AS geojson,
           ST_X(ST_Centroid(c.geom)) AS lng,
           ST_Y(ST_Centroid(c.geom)) AS lat,
           (SELECT ST_Distance(ST_Centroid(c.geom)::geography, s.geom::geography) / 1000.0
              FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}
              ORDER BY s.geom <-> ST_Centroid(c.geom) LIMIT 1) AS d_sekolah_km,
           (SELECT ST_Distance(ST_Centroid(c.geom)::geography, j.geom::geography) / 1000.0
              FROM jalan j WHERE j.geom IS NOT NULL AND ${active('j')}
              ORDER BY j.geom <-> ST_Centroid(c.geom) LIMIT 1) AS d_jalan_km,
           (SELECT MAX(lc.level) FROM layer_constraint lc
              WHERE lc.jenis = 'risiko_bencana' AND ${active('lc')} AND ST_Intersects(lc.geom, c.geom)) AS risiko,
           (SELECT MAX(lc.nilai) FROM layer_constraint lc
              WHERE lc.jenis = 'lereng' AND ${active('lc')} AND ST_Intersects(lc.geom, c.geom)) AS lereng,
           EXISTS (SELECT 1 FROM layer_constraint lc
              WHERE lc.jenis = 'kawasan_lindung' AND ${active('lc')} AND ST_Intersects(lc.geom, ST_Centroid(c.geom))) AS di_kawasan_lindung
    FROM cells c
  `;
  const r = await client.query(sql, [tahun, idWilayah || null, topWilayah, cellMeters]);
  return r.rows;
}

function normalizeWeights(input) {
  const base = { ...cfg.BOBOT_KANDIDAT };
  if (input && typeof input === 'object') {
    Object.keys(base).forEach((k) => {
      const v = Number(input[k]);
      if (Number.isFinite(v) && v >= 0) base[k] = v;
    });
  }
  return base;
}

/**
 * Menghasilkan & menyimpan area kandidat (status 'Rekomendasi').
 * Hasil sebelumnya berstatus 'Rekomendasi' pada cakupan yang sama ditimpa; kandidat yang sudah
 * diproses stakeholder (Disetujui/Ditolak/Dipertimbangkan) tidak dihapus.
 */
async function generateCandidates(params = {}) {
  const tahun = await resolveTahun(params.tahun);
  const cellKm = Number(params.cell_km) > 0 ? Number(params.cell_km) : 1;
  if (cellKm < 0.2 || cellKm > 5) throw httpError(400, 'cell_km harus antara 0.2 dan 5.');
  const topWilayah = Math.min(Math.max(parseInt(params.top_wilayah, 10) || 5, 1), 40);
  const topN = Math.min(Math.max(parseInt(params.top_n, 10) || 10, 1), 50);
  const idWilayah = params.id_wilayah ? parseInt(params.id_wilayah, 10) : null;
  const radiusKm = Number(params.radius_km) > 0 ? Number(params.radius_km) : cfg.COVERAGE_RADIUS_KM;

  const batas = { ...cfg.KANDIDAT };
  ['MIN_JARAK_SEKOLAH_KM', 'MAX_JARAK_JALAN_KM', 'MAX_RISIKO_LEVEL', 'MAX_LERENG_PCT'].forEach((k) => {
    const v = Number(params.batas && params.batas[k]);
    if (Number.isFinite(v) && v >= 0) batas[k] = v;
  });
  const bobot = normalizeWeights(params.bobot);

  const check = await db.query('SELECT COUNT(*)::int AS n FROM priority_score WHERE tahun = $1', [tahun]);
  if (check.rows[0].n === 0) {
    throw httpError(409, 'Skor prioritas belum dihitung. Jalankan perhitungan ulang analisis terlebih dahulu.');
  }
  const schools = await db.query(`SELECT COUNT(*)::int AS n FROM sekolah s WHERE ${active('s')}`);
  if (schools.rows[0].n === 0) throw httpError(409, 'Belum ada data sekolah aktif.');

  const tersedia = await layerAvailability();
  const cells = await fetchCells({ tahun, idWilayah, topWilayah, cellMeters: cellKm * 1000 });
  if (cells.length === 0) throw httpError(404, 'Tidak ada sel analisis yang terbentuk. Periksa wilayah dan ukuran sel.');

  const ctx = { tersedia, bobot, batas, radiusKm };
  const scored = cells.map((c) => {
    const s = S.scoreKandidat(c, ctx);
    return { ...c, ...s, id_wilayah: c.id_wilayah };
  });
  const layak = scored.filter((c) => c.layak).length;
  const picked = S.pickTopKandidat(scored, {
    topN,
    maxPerWilayah: Math.min(Math.max(parseInt(params.max_per_wilayah, 10) || 3, 1), 20),
    minSeparationKm: cellKm * 1.5,
  });

  const saved = await db.withTransaction(async (client) => {
    const wilayahScope = idWilayah ? [idWilayah] : [...new Set(cells.map((c) => c.id_wilayah))];
    await client.query(
      `DELETE FROM candidate_area WHERE tahun = $1 AND status_kandidat = 'Rekomendasi' AND id_wilayah = ANY($2::bigint[])`,
      [tahun, wilayahScope]
    );
    const out = [];
    for (const c of picked) {
      const detail = {
        komponen: c.komponen,
        jarak_sekolah_km: S.round(c.d_sekolah_km, 2),
        jarak_jalan_km: S.round(c.d_jalan_km, 2),
        risiko_level: c.risiko,
        lereng_pct: c.lereng,
        skor_wilayah: S.round(c.skor_wilayah, 2),
        layer_tersedia: tersedia,
        ukuran_sel_km: cellKm,
      };
      const ins = await client.query(
        `INSERT INTO candidate_area (id_wilayah, tahun, skor_suitability, status_kandidat, luas_ha, geom, detail)
         VALUES ($1, $2, $3, 'Rekomendasi', $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6::jsonb)
         RETURNING id_candidate`,
        [c.id_wilayah, tahun, c.skor, cellKm * cellKm * 100, c.geojson, JSON.stringify(detail)]
      );
      out.push(ins.rows[0].id_candidate);
    }
    return out;
  });

  return {
    tahun,
    sel_dianalisis: cells.length,
    sel_layak: layak,
    kandidat_tersimpan: saved.length,
    layer_tersedia: tersedia,
    catatan: [
      !tersedia.jalan && 'Data jaringan jalan belum tersedia: kriteria akses jalan dilewati.',
      !tersedia.risiko_bencana && 'Data risiko bencana belum tersedia: kriteria risiko dilewati.',
      !tersedia.lereng && 'Data lereng/topografi belum tersedia: kriteria kemiringan dilewati.',
    ].filter(Boolean),
  };
}

module.exports = { generateCandidates, layerAvailability, normalizeWeights };
