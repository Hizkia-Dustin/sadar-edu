const db = require('../config/db');
const cfg = require('../config/analysis');
const { active } = require('../utils/sql');
const { httpError } = require('../middleware/errorHandler');
const population = require('../data/bogor-kecamatan.geojson.json');
const analysis = require('./analysisService');
const scoring = require('./scoring');

// Snapshot terpisah: data penduduk total tidak menggantikan input usia SMP untuk MCDA.
const districts = JSON.stringify(population.features.map((feature) => ({
  id: feature.properties.id,
  nama: feature.properties.nama,
  geometry: feature.geometry,
})));

async function getBlankSpots({ radiusKm = cfg.COVERAGE_RADIUS_KM } = {}) {
  const radius = Number(radiusKm);
  if (!Number.isFinite(radius) || radius <= 0 || radius > 20) {
    throw httpError(400, 'Radius harus lebih dari 0 dan maksimal 20 km.');
  }

  // Geography memakai meter; selisih buffer hanya dihitung di 46 poligon, tanpa menulis dataset demo.
  const result = await db.query(`
    WITH districts AS (
      SELECT id, nama, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326)) AS geom
      FROM jsonb_to_recordset($1::jsonb) AS district(id text, nama text, geometry jsonb)
    ), coverage AS (
      SELECT ST_Union(ST_Buffer(s.geom::geography, $2::float8)::geometry) AS geom,
             COUNT(*)::integer AS school_count
      FROM sekolah s WHERE s.geom IS NOT NULL AND ${active('s')}
    ), blanks AS (
      SELECT d.id, d.nama, c.school_count, d.geom AS district_geom,
             ST_CollectionExtract(ST_MakeValid(ST_Difference(d.geom,
               COALESCE(c.geom, ST_GeomFromText('POLYGON EMPTY', 4326)))), 3) AS geom
      FROM districts d CROSS JOIN coverage c
    )
    SELECT id, nama, school_count,
           ROUND((100 * ST_Area(geom::geography) / NULLIF(ST_Area(district_geom::geography), 0))::numeric, 2) AS persen_blank,
           ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001)) AS geojson
    FROM blanks WHERE NOT ST_IsEmpty(geom)
    ORDER BY nama
  `, [districts, radius * 1000]);

  return {
    type: 'FeatureCollection',
    features: result.rows.map(({ geojson, ...properties }) => ({
      type: 'Feature', id: properties.id, properties, geometry: JSON.parse(geojson),
    })),
    meta: { radius_km: radius, method: 'Jarak lurus dari seluruh titik sekolah aktif, bukan jarak perjalanan atau bukti tidak ada sekolah.' },
  };
}

// Nama hanya dipakai untuk menyambungkan input DEMO kabupaten yang sudah ada.
// Kota tidak pernah dipadankan ke wilayah kabupaten meski nama suatu saat sama.
const normalizeName = (name) => name.toLowerCase().replace(/\s+/g, '');

function scoreNeeds(metricRows, indicators) {
  // Usia SMP wajib tersedia agar perbandingan tujuh indikator tetap setara.
  // Nol/kosong bukan bukti kebutuhan rendah; kota tanpa data tidak ikut normalisasi.
  const eligible = metricRows.filter((row) => row.penduduk_usia_smp > 0);
  return scoring.computeScores(eligible.map((metrics) => ({ id: metrics.id_wilayah, metrics })), indicators).results;
}

async function getNeeds() {
  const [year, indicators, demoDistricts] = await Promise.all([
    analysis.resolveTahun(), analysis.getIndikator(),
    db.query("SELECT id_wilayah, nama_wilayah FROM wilayah WHERE kode_bps LIKE 'DEMO-%' AND level_wilayah = 'Kecamatan'"),
  ]);
  const idsByName = new Map(demoDistricts.rows.map((row) => [normalizeName(row.nama_wilayah), row.id_wilayah]));
  const geography = population.features.map((feature) => ({
    id: feature.properties.id, nama: feature.properties.nama, geometry: feature.geometry,
    demographic_id: feature.properties.region === 'kabupaten' ? idsByName.get(normalizeName(feature.properties.nama)) ?? null : null,
  }));
  const metrics = await analysis.collectMetrics(year, cfg.COVERAGE_RADIUS_KM, db, geography);
  const scores = new Map(scoreNeeds(metrics, indicators).map((result) => [result.id, result]));
  return {
    type: 'FeatureCollection',
    features: population.features.map((feature) => {
      const result = scores.get(feature.id);
      const diagnosis = result ? scoring.diagnose({ nama: feature.properties.nama, metrics: result.metrics, kontribusi: result.kontribusi, indikator: indicators }) : null;
      return { ...feature, properties: {
        id_wilayah: feature.id, nama_wilayah: feature.properties.nama,
        kabupaten_kota: feature.properties.kabupaten_kota,
        skor_total: result?.skor ?? null, kategori_prioritas: result?.kategori ?? null,
        ranking: result?.ranking ?? null, metrik: result?.metrics ?? null,
        diagnosis: diagnosis?.ringkasan ?? 'Data penduduk usia SMP belum tersedia; kebutuhan belum dapat dinilai.',
        faktor_utama: diagnosis?.faktor_utama ?? [], tahun: year, simulasi: true,
      } };
    }),
    meta: {
      tahun: year, simulasi: true, radius_km: cfg.COVERAGE_RADIUS_KM, kategori: cfg.KATEGORI,
      parameter: { target_apk: cfg.TARGET_APK, siswa_per_rombel: cfg.SISWA_PER_ROMBEL },
      indikator: indicators.map((indicator) => ({ kode: indicator.kode_indikator, nama: indicator.nama_indikator, bobot: indicator.bobot })),
      catatan: 'Simulasi MCDA memakai sekolah dan penduduk usia SMP demo, dihitung ulang pada batas geografis baru. Penduduk total BPS 2024 tidak dipakai sebagai penduduk usia SMP.',
    },
  };
}

module.exports = { population, getBlankSpots, getNeeds, scoreNeeds };
