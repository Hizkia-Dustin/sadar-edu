const db = require('../config/db');
const cfg = require('../config/analysis');
const S = require('./scoring');
const { active } = require('../utils/sql');
const { httpError } = require('../middleware/errorHandler');

const EMPTY_POLY = "ST_GeomFromText('POLYGON EMPTY', 4326)";

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

/** Tahun data: parameter bila ada, jika tidak tahun statistik terbaru, jika tidak tahun berjalan */
async function resolveTahun(tahun, client = db) {
  const t = parseInt(tahun, 10);
  if (Number.isFinite(t)) return t;
  const r = await client.query('SELECT MAX(tahun) AS t FROM statistik_pendidikan');
  return (r.rows[0] && r.rows[0].t) || new Date().getFullYear();
}

async function getIndikator(client = db) {
  const r = await client.query('SELECT * FROM indikator ORDER BY id_indikator ASC');
  return r.rows;
}

// ---------------------------------------------------------------------------
// Pengumpulan metrik per kecamatan (PostGIS)
// ---------------------------------------------------------------------------

/**
 * Mengumpulkan metrik mentah tiap kecamatan:
 * - penduduk & penduduk usia SMP (data kependudukan terbaru <= tahun)
 * - jumlah sekolah, siswa, guru, rombel, ruang kelas (spatial join + statistik terbaru <= tahun)
 * - blank_pct: % luas kecamatan di luar buffer radius km dari seluruh sekolah (buffer analysis)
 * - jarak_terdekat_km: jarak titik representatif kecamatan ke sekolah terdekat
 */
async function collectMetrics(tahun, radiusKm = cfg.COVERAGE_RADIUS_KM, client = db) {
  const sql = `
    WITH kec AS (
      SELECT w.id_wilayah, w.kode_bps, w.nama_wilayah, ST_MakeValid(w.geom) AS geom,
             COALESCE(w.luas_km2, ST_Area(w.geom::geography) / 1000000.0) AS luas_km2
      FROM wilayah w
      WHERE w.level_wilayah = 'Kecamatan' AND w.geom IS NOT NULL AND ${active('w')}
    ),
    cov AS (
      SELECT ST_Union(ST_Buffer(s.geom::geography, $1::float8)::geometry) AS geom
      FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}
    )
    SELECT k.id_wilayah, k.kode_bps, k.nama_wilayah, k.luas_km2,
           COALESCE(kp.jumlah_penduduk, 0)    AS penduduk,
           COALESCE(kp.penduduk_usia_smp, 0)  AS penduduk_usia_smp,
           COALESCE(sc.jumlah_sekolah, 0)     AS jumlah_sekolah,
           COALESCE(sc.jumlah_siswa, 0)       AS jumlah_siswa,
           COALESCE(sc.jumlah_guru, 0)        AS jumlah_guru,
           COALESCE(sc.jumlah_rombel, 0)      AS jumlah_rombel,
           COALESCE(sc.jumlah_ruang_kelas, 0) AS jumlah_ruang_kelas,
           CASE WHEN cov.geom IS NULL THEN 100
                ELSE LEAST(100, GREATEST(0, 100.0 *
                     ST_Area(ST_Difference(k.geom, cov.geom)::geography) /
                     NULLIF(ST_Area(k.geom::geography), 0)))
           END AS blank_pct,
           nn.jarak_km AS jarak_terdekat_km
    FROM kec k
    CROSS JOIN cov
    LEFT JOIN LATERAL (
      SELECT x.jumlah_penduduk, x.penduduk_usia_smp
      FROM kependudukan x
      WHERE x.id_wilayah = k.id_wilayah AND x.tahun <= $2::int AND ${active('x')}
      ORDER BY x.tahun DESC LIMIT 1
    ) kp ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS jumlah_sekolah,
             COALESCE(SUM(st.jumlah_siswa), 0)::int       AS jumlah_siswa,
             COALESCE(SUM(st.jumlah_guru), 0)::int        AS jumlah_guru,
             COALESCE(SUM(st.jumlah_rombel), 0)::int      AS jumlah_rombel,
             COALESCE(SUM(st.jumlah_ruang_kelas), 0)::int AS jumlah_ruang_kelas
      FROM sekolah s
      LEFT JOIN LATERAL (
        SELECT y.jumlah_siswa, y.jumlah_guru, y.jumlah_rombel, y.jumlah_ruang_kelas
        FROM statistik_pendidikan y
        WHERE y.id_sekolah = s.id_sekolah AND y.tahun <= $2::int AND ${active('y')}
        ORDER BY y.tahun DESC LIMIT 1
      ) st ON TRUE
      WHERE s.geom IS NOT NULL AND ST_Covers(k.geom, s.geom) AND ${active('s')}
    ) sc ON TRUE
    LEFT JOIN LATERAL (
      SELECT ST_Distance(ST_PointOnSurface(k.geom)::geography, s.geom::geography) / 1000.0 AS jarak_km
      FROM sekolah s
      WHERE s.geom IS NOT NULL AND ${active('s')}
      ORDER BY s.geom <-> ST_PointOnSurface(k.geom)
      LIMIT 1
    ) nn ON TRUE
    ORDER BY k.nama_wilayah ASC
  `;
  const r = await client.query(sql, [radiusKm * 1000, tahun]);
  return r.rows;
}

// ---------------------------------------------------------------------------
// Hitung & simpan skor
// ---------------------------------------------------------------------------

function buildResultRows(results, metricRows, indikator, radiusKm) {
  const nameById = Object.fromEntries(metricRows.map((m) => [m.id_wilayah, m.nama_wilayah]));
  return results.map((r) => {
    const diag = S.diagnose({ nama: nameById[r.id], metrics: r.metrics, kontribusi: r.kontribusi, indikator, cfg });
    const intervensi = S.recommendIntervensi(r.metrics, cfg);
    return {
      id_wilayah: r.id,
      skor: r.skor,
      ranking: r.ranking,
      kategori: r.kategori,
      raw: r.raw,
      norm: r.norm,
      diagnosis: diag.ringkasan,
      metrik: {
        ...r.metrics,
        radius_km: radiusKm,
        demand_kursi: S.round(S.demandOf(r.metrics, cfg), 0),
        kapasitas_kursi: S.round(S.kapasitasOf(r.metrics, cfg), 0),
        gap_kursi: S.round(S.gapKursiOf(r.metrics, cfg), 0),
      },
      rekomendasi: { masalah: diag.masalah, faktor_utama: diag.faktor_utama, intervensi },
    };
  });
}

async function persistScores(client, tahun, rows, indikator) {
  const idByKode = Object.fromEntries(indikator.map((i) => [i.kode_indikator, i.id_indikator]));
  for (const r of rows) {
    for (const [kode, raw] of Object.entries(r.raw)) {
      if (!idByKode[kode]) continue;
      await client.query(
        `INSERT INTO nilai_indikator (id_wilayah, id_indikator, tahun, nilai_raw, nilai_normalisasi)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_wilayah, id_indikator, tahun)
         DO UPDATE SET nilai_raw = EXCLUDED.nilai_raw, nilai_normalisasi = EXCLUDED.nilai_normalisasi`,
        [r.id_wilayah, idByKode[kode], tahun, raw, r.norm[kode]]
      );
    }
    await client.query(
      `INSERT INTO priority_score (id_wilayah, tahun, skor_total, ranking, kategori_prioritas, diagnosis, metrik, rekomendasi)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       ON CONFLICT (id_wilayah, tahun)
       DO UPDATE SET skor_total = EXCLUDED.skor_total, ranking = EXCLUDED.ranking,
                     kategori_prioritas = EXCLUDED.kategori_prioritas, diagnosis = EXCLUDED.diagnosis,
                     metrik = EXCLUDED.metrik, rekomendasi = EXCLUDED.rekomendasi`,
      [r.id_wilayah, tahun, r.skor, r.ranking, r.kategori, r.diagnosis, JSON.stringify(r.metrik), JSON.stringify(r.rekomendasi)]
    );
  }
}

/**
 * Hitung ulang SEMUA: metrik spasial -> indikator -> normalisasi -> skor -> simpan.
 * Dijalankan setelah dataset berubah. Memakai bobot indikator yang tersimpan.
 */
async function recalculate({ tahun, radiusKm } = {}) {
  const t = await resolveTahun(tahun);
  const radius = Number.isFinite(Number(radiusKm)) && Number(radiusKm) > 0 ? Number(radiusKm) : cfg.COVERAGE_RADIUS_KM;
  const indikator = await getIndikator();
  if (indikator.length === 0) throw httpError(409, 'Master indikator kosong. Jalankan server sekali agar seed indikator terisi.');

  const metricRows = await collectMetrics(t, radius);
  if (metricRows.length === 0) {
    throw httpError(409, "Belum ada wilayah level 'Kecamatan' yang aktif. Unggah dataset batas wilayah terlebih dahulu.");
  }

  const { results } = S.computeScores(
    metricRows.map((m) => ({ id: m.id_wilayah, metrics: m })),
    indikator,
    { cfg }
  );
  const rows = buildResultRows(results, metricRows, indikator, radius);

  await db.withTransaction(async (client) => {
    await persistScores(client, t, rows, indikator);
  });

  return { tahun: t, radius_km: radius, jumlah_wilayah: rows.length, dihitung_pada: new Date().toISOString() };
}

/** Hitung ulang skor saja (bobot berubah) dari nilai mentah tersimpan: cepat, tanpa query spasial */
async function rescore({ tahun } = {}) {
  const t = await resolveTahun(tahun);
  const indikator = await getIndikator();
  const ps = await db.query(
    `SELECT p.id_wilayah, w.nama_wilayah, p.metrik
     FROM priority_score p JOIN wilayah w ON w.id_wilayah = p.id_wilayah
     WHERE p.tahun = $1`,
    [t]
  );
  if (ps.rows.length === 0) throw httpError(409, 'Skor belum pernah dihitung. Jalankan perhitungan ulang analisis terlebih dahulu.');

  const metricRows = ps.rows.map((p) => ({ id_wilayah: p.id_wilayah, nama_wilayah: p.nama_wilayah, ...(p.metrik || {}) }));
  const radius = (ps.rows[0].metrik && ps.rows[0].metrik.radius_km) || cfg.COVERAGE_RADIUS_KM;
  const { results } = S.computeScores(
    metricRows.map((m) => ({ id: m.id_wilayah, metrics: m })),
    indikator,
    { cfg }
  );
  const rows = buildResultRows(results, metricRows, indikator, radius);
  await db.withTransaction(async (client) => {
    await persistScores(client, t, rows, indikator);
  });
  return { tahun: t, jumlah_wilayah: rows.length };
}

// ---------------------------------------------------------------------------
// Model baca untuk API
// ---------------------------------------------------------------------------

/** GeoJSON kecamatan + skor prioritas + diagnosis + indikator (dasar peta prioritas & dashboard) */
async function getPrioritasGeoJSON({ tahun, simplify = 0.0003 } = {}) {
  const t = await resolveTahun(tahun);
  const tol = Math.max(0, Number(simplify) || 0);
  const sql = `
    SELECT w.id_wilayah, w.kode_bps, w.nama_wilayah, w.luas_km2,
           ps.skor_total, ps.ranking, ps.kategori_prioritas, ps.diagnosis, ps.metrik, ps.rekomendasi,
           (SELECT json_agg(json_build_object('kode', i.kode_indikator, 'raw', ni.nilai_raw, 'norm', ni.nilai_normalisasi)
                            ORDER BY i.id_indikator)
            FROM nilai_indikator ni JOIN indikator i ON i.id_indikator = ni.id_indikator
            WHERE ni.id_wilayah = w.id_wilayah AND ni.tahun = $1::int) AS indikator,
           ST_AsGeoJSON(CASE WHEN $2::float8 > 0 THEN ST_SimplifyPreserveTopology(w.geom, $2::float8) ELSE w.geom END) AS geojson
    FROM wilayah w
    LEFT JOIN priority_score ps ON ps.id_wilayah = w.id_wilayah AND ps.tahun = $1::int
    WHERE w.level_wilayah = 'Kecamatan' AND w.geom IS NOT NULL AND ${active('w')}
    ORDER BY ps.ranking ASC NULLS LAST, w.nama_wilayah ASC
  `;
  const r = await db.query(sql, [t, tol]);
  const indikator = await getIndikator();
  const computed = r.rows.some((x) => x.skor_total !== null);

  const features = r.rows.map((row) => {
    const { geojson, ...props } = row;
    return {
      type: 'Feature',
      id: row.id_wilayah,
      geometry: geojson ? JSON.parse(geojson) : null,
      properties: props,
    };
  });

  return {
    type: 'FeatureCollection',
    features,
    meta: {
      tahun: t,
      sudah_dihitung: computed,
      radius_km: (r.rows.find((x) => x.metrik) || {}).metrik?.radius_km || cfg.COVERAGE_RADIUS_KM,
      indikator: indikator.map((i) => ({
        kode: i.kode_indikator,
        nama: i.nama_indikator,
        satuan: i.satuan,
        arah: i.arah_pengaruh,
        bobot: i.bobot,
        kelompok: i.kelompok,
        deskripsi: i.deskripsi,
      })),
      parameter: {
        siswa_per_rombel: cfg.SISWA_PER_ROMBEL,
        target_apk: cfg.TARGET_APK,
        ambang_siswa_per_guru: cfg.AMBANG_SISWA_PER_GURU,
        ambang_blank_spot_pct: cfg.AMBANG_BLANK_SPOT_PCT,
        sekolah_baru_ruang_kelas: cfg.SEKOLAH_BARU_RUANG_KELAS,
        sekolah_baru_guru: cfg.SEKOLAH_BARU_GURU,
      },
      kategori: cfg.KATEGORI,
    },
  };
}

/** Area di luar jangkauan sekolah (blank spot) per kecamatan sebagai GeoJSON poligon */
async function getBlankSpotsGeoJSON({ radiusKm = cfg.COVERAGE_RADIUS_KM, simplify = 0.0004 } = {}) {
  const radius = Number(radiusKm) > 0 ? Number(radiusKm) : cfg.COVERAGE_RADIUS_KM;
  const sql = `
    WITH cov AS (
      SELECT ST_Union(ST_Buffer(s.geom::geography, $1::float8)::geometry) AS geom
      FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}
    ),
    blank AS (
      SELECT w.id_wilayah, w.nama_wilayah, ST_MakeValid(w.geom) AS wgeom,
             ST_CollectionExtract(
               ST_MakeValid(ST_Difference(ST_MakeValid(w.geom), COALESCE(cov.geom, ${EMPTY_POLY}))), 3) AS bgeom
      FROM wilayah w CROSS JOIN cov
      WHERE w.level_wilayah = 'Kecamatan' AND w.geom IS NOT NULL AND ${active('w')}
    )
    SELECT id_wilayah, nama_wilayah,
           ROUND((100.0 * ST_Area(bgeom::geography) / NULLIF(ST_Area(wgeom::geography), 0))::numeric, 2) AS persen_blank,
           ST_AsGeoJSON(ST_SimplifyPreserveTopology(bgeom, $2::float8)) AS geojson
    FROM blank
    WHERE bgeom IS NOT NULL AND NOT ST_IsEmpty(bgeom)
    ORDER BY nama_wilayah
  `;
  const r = await db.query(sql, [radius * 1000, Number(simplify) || 0]);
  return {
    type: 'FeatureCollection',
    features: r.rows.map(({ geojson, ...props }) => ({
      type: 'Feature',
      id: props.id_wilayah,
      geometry: geojson ? JSON.parse(geojson) : null,
      properties: props,
    })),
    meta: { radius_km: radius },
  };
}

/** Gabungan area jangkauan sekolah (buffer radius) sebagai satu GeoJSON */
async function getCoverageGeoJSON({ radiusKm = cfg.COVERAGE_RADIUS_KM, simplify = 0.0005 } = {}) {
  const radius = Number(radiusKm) > 0 ? Number(radiusKm) : cfg.COVERAGE_RADIUS_KM;
  const r = await db.query(
    `SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Union(ST_Buffer(s.geom::geography, $1::float8)::geometry), $2::float8)) AS geojson
     FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}`,
    [radius * 1000, Number(simplify) || 0]
  );
  const g = r.rows[0] && r.rows[0].geojson;
  return {
    type: 'FeatureCollection',
    features: g ? [{ type: 'Feature', geometry: JSON.parse(g), properties: { radius_km: radius } }] : [],
    meta: { radius_km: radius },
  };
}

/** Ringkasan untuk beranda/dashboard */
async function getRingkasan({ tahun } = {}) {
  const t = await resolveTahun(tahun);
  const [tot, kat, top, demo] = await Promise.all([
    db.query(
      `SELECT (SELECT COUNT(*) FROM wilayah w WHERE w.level_wilayah = 'Kecamatan' AND ${active('w')})::int AS kecamatan,
              (SELECT COUNT(*) FROM sekolah s WHERE ${active('s')})::int AS sekolah,
              COALESCE((SELECT SUM((metrik->>'jumlah_siswa')::numeric) FROM priority_score WHERE tahun = $1), 0)::int AS siswa,
              COALESCE((SELECT SUM((metrik->>'penduduk_usia_smp')::numeric) FROM priority_score WHERE tahun = $1), 0)::int AS usia_smp,
              COALESCE((SELECT SUM((metrik->>'gap_kursi')::numeric) FROM priority_score WHERE tahun = $1), 0)::int AS gap_kursi`,
      [t]
    ),
    db.query(
      `SELECT kategori_prioritas AS kategori, COUNT(*)::int AS jumlah
       FROM priority_score WHERE tahun = $1 GROUP BY kategori_prioritas`,
      [t]
    ),
    db.query(
      `SELECT w.id_wilayah, w.nama_wilayah, p.skor_total, p.kategori_prioritas, p.ranking
       FROM priority_score p JOIN wilayah w ON w.id_wilayah = p.id_wilayah
       WHERE p.tahun = $1 ORDER BY p.ranking ASC NULLS LAST LIMIT 5`,
      [t]
    ),
    db.query(`SELECT COUNT(*)::int AS n FROM dataset_metadata WHERE aktif IS NOT FALSE AND sumber ILIKE 'DEMO%'`),
  ]);
  return {
    tahun: t,
    ...tot.rows[0],
    per_kategori: kat.rows,
    prioritas_teratas: top.rows,
    menggunakan_data_demo: demo.rows[0].n > 0,
  };
}

/**
 * Dampak penambahan sekolah baru di titik tertentu terhadap aksesibilitas satu kecamatan:
 * blank_pct (% luas di luar jangkauan) dan jarak ke sekolah terdekat SETELAH sekolah ditambahkan.
 */
async function accessAfterNewSchools(idWilayah, radiusKm, points) {
  const r = await db.query(
    `WITH w AS (SELECT ST_MakeValid(geom) AS geom FROM wilayah WHERE id_wilayah = $1),
          cov AS (SELECT ST_Union(ST_Buffer(s.geom::geography, $2::float8)::geometry) AS geom
                  FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}),
          newp AS (SELECT ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326) AS geom
                   FROM jsonb_to_recordset($3::jsonb) AS p(lng float8, lat float8)),
          newcov AS (SELECT ST_Union(ST_Buffer(geom::geography, $2::float8)::geometry) AS geom FROM newp)
     SELECT LEAST(100, GREATEST(0, 100.0 * ST_Area(ST_Difference(w.geom,
              ST_Union(COALESCE(cov.geom, ${EMPTY_POLY}), COALESCE(newcov.geom, ${EMPTY_POLY})))::geography)
              / NULLIF(ST_Area(w.geom::geography), 0))) AS blank_pct,
            (SELECT MIN(d) FROM (
               SELECT ST_Distance(ST_PointOnSurface(w.geom)::geography, p.geom::geography) / 1000.0 AS d FROM newp p
               UNION ALL
               (SELECT ST_Distance(ST_PointOnSurface(w.geom)::geography, s.geom::geography) / 1000.0
                  FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}
                  ORDER BY s.geom <-> ST_PointOnSurface(w.geom) LIMIT 1)
             ) t) AS jarak_km
     FROM w CROSS JOIN cov CROSS JOIN newcov`,
    [idWilayah, radiusKm * 1000, JSON.stringify(points)]
  );
  return r.rows[0] || null;
}

module.exports = {
  resolveTahun,
  getIndikator,
  collectMetrics,
  recalculate,
  rescore,
  getPrioritasGeoJSON,
  getBlankSpotsGeoJSON,
  getCoverageGeoJSON,
  getRingkasan,
  accessAfterNewSchools,
  EMPTY_POLY,
};
