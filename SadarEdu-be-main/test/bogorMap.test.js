const { test } = require('node:test');
const assert = require('node:assert/strict');
const { booleanPointInPolygon, point } = require('@turf/turf');
const { population, getBlankSpots, scoreNeeds } = require('../src/services/bogorMapService');
const { INDIKATOR_DEFAULT } = require('../src/services/scoring');
const { collectMetrics } = require('../src/services/analysisService');

test('46 kecamatan unik dengan jumlah penduduk sesuai total sumber 2024', () => {
  assert.equal(population.features.length, 46);
  assert.equal(new Set(population.features.map((f) => f.id)).size, 46);
  for (const [region, count, total] of [['kabupaten', 40, 5682303], ['kota', 6, 1137018]]) {
    const features = population.features.filter((f) => f.properties.region === region);
    assert.equal(features.length, count);
    assert.equal(features.reduce((sum, f) => sum + f.properties.penduduk, 0), total);
    assert.ok(features.every((f) => f.properties.tahun === 2024 && f.bbox.length === 4));
  }
});

test('batas mencakup Kota Bogor dan Cibinong, tidak mencakup titik pusat Depok', () => {
  const contains = (coordinates) => population.features.some((f) => booleanPointInPolygon(point(coordinates), f));
  assert.equal(contains([106.798, -6.597]), true);
  assert.equal(contains([106.854, -6.479]), true);
  assert.equal(contains([106.824, -6.402]), false);
});

test('radius tidak valid ditolak sebelum query spasial', async () => {
  for (const radiusKm of [0, -1, 21, Infinity, 'abc']) {
    await assert.rejects(getBlankSpots({ radiusKm }), (error) => error.status === 400);
  }
});

test('wilayah tanpa usia SMP tidak diberi skor dan tidak mengubah normalisasi wilayah lengkap', () => {
  const complete = [
    { id_wilayah: 'a', penduduk_usia_smp: 2000, luas_km2: 30, jumlah_sekolah: 5, jumlah_siswa: 1500, jumlah_guru: 100, jumlah_ruang_kelas: 50, blank_pct: 5, jarak_terdekat_km: 0.5 },
    { id_wilayah: 'b', penduduk_usia_smp: 6000, luas_km2: 30, jumlah_sekolah: 2, jumlah_siswa: 2000, jumlah_guru: 40, jumlah_ruang_kelas: 20, blank_pct: 90, jarak_terdekat_km: 5 },
  ];
  const expected = scoreNeeds(complete, INDIKATOR_DEFAULT);
  const actual = scoreNeeds([...complete, { id_wilayah: 'city', penduduk_usia_smp: 0, blank_pct: 100, jarak_terdekat_km: 999 }], INDIKATOR_DEFAULT);
  assert.deepEqual(actual, expected);
  assert.equal(actual.length, 2);
  assert.equal(actual.find((r) => r.id === 'b').kategori, 'Sangat Tinggi');
});

test('override geometri hanya memakai parameter query dan tidak mengubah jalur dashboard', async () => {
  const queries = [];
  const client = { query: async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; } };
  await collectMetrics(2026, 3, client);
  const geography = [{ id: 'geo:kabupaten:cibinong', demographic_id: 15, nama: 'Cibinong', geometry: { type: 'Polygon', coordinates: [] } }];
  await collectMetrics(2026, 3, client, geography);
  assert.deepEqual(queries[0].params, [3000, 2026]);
  assert.match(queries[0].sql, /FROM wilayah w/);
  assert.equal(queries[1].params[2], JSON.stringify(geography));
  assert.match(queries[1].sql, /jsonb_to_recordset\(\$3::jsonb\)/);
  assert.match(queries[1].sql, /ST_Covers\(k.geom, s.geom\)/);
});
