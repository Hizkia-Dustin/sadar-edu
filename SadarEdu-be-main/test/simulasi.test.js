const { fakePool } = require('./helpers/stubDeps');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createScenario } = require('../src/controllers/simulasiController');
const S = require('../src/services/scoring');

const metrikA = { id_wilayah: 1, penduduk: 100000, penduduk_usia_smp: 2700, luas_km2: 30, jumlah_sekolah: 2, jumlah_siswa: 1800, jumlah_guru: 60, jumlah_rombel: 56, jumlah_ruang_kelas: 40, blank_pct: 60, jarak_terdekat_km: 4, radius_km: 3 };
const mockRes = () => { const r = { statusCode: 200 }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

function setupDb({ withAccess = false } = {}) {
  const writes = [];
  fakePool.__next = async (text) => {
    if (/MAX\(tahun\) AS t/.test(text)) return { rows: [{ t: 2026 }] };
    if (/FROM priority_score p JOIN wilayah/.test(text)) return { rows: [{ metrik: metrikA, nama_wilayah: 'Kec A' }] };
    if (/FROM indikator ORDER/.test(text)) return { rows: S.INDIKATOR_DEFAULT.map((i, n) => ({ id_indikator: n + 1, ...i })) };
    if (/GROUP BY i.kode_indikator/.test(text)) {
      const { stats } = S.computeScores([{ id: 1, metrics: metrikA }, { id: 2, metrics: { ...metrikA, jumlah_sekolah: 6, jumlah_siswa: 1000, jumlah_ruang_kelas: 60, blank_pct: 5, jarak_terdekat_km: 1 } }], S.INDIKATOR_DEFAULT);
      return { rows: Object.entries(stats).map(([kode_indikator, v]) => ({ kode_indikator, min: v.min, max: v.max })) };
    }
    if (/ST_X\(ST_Centroid/.test(text)) return { rows: [{ lng: 106.8, lat: -6.6 }] };
    if (/jsonb_to_recordset/.test(text) && withAccess) return { rows: [{ blank_pct: 25, jarak_km: 1.2 }] };
    if (/INSERT INTO scenario_intervensi/.test(text)) { writes.push('scenario'); return { rows: [{ id_scenario: 7 }] }; }
    if (/INSERT INTO hasil_simulasi/.test(text)) { writes.push('hasil'); return { rows: [{ id_hasil: 9 }] }; }
    return { rows: [] };
  };
  return writes;
}

test('simulasi: pratinjau (simpan=false) tidak menulis ke database', async () => {
  const writes = setupDb();
  const res = mockRes();
  await createScenario({ body: { id_wilayah: 1, simpan: false, tipe_intervensi: 'Sekolah Baru', parameter_json: { sekolah_baru: 2 } } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(writes, []);
  assert.ok(res.body.simulasi.after.skor < res.body.simulasi.before.skor);
  assert.ok(res.body.catatan.some((c) => /Lokasi sekolah baru/.test(c)));
});

test('simulasi: simpan menulis skenario + hasil dan memakai lokasi kandidat untuk aksesibilitas', async () => {
  const writes = setupDb({ withAccess: true });
  const res = mockRes();
  await createScenario({ body: { id_wilayah: 1, nama_scenario: 'Uji', tipe_intervensi: 'Sekolah Baru', parameter_json: { id_candidate: 3 } } }, res, (e) => { throw e; });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(writes, ['scenario', 'hasil']);
  assert.equal(res.body.simulasi.tambahan.sekolah, 1);
  assert.equal(res.body.simulasi.after.indikator.AKSES_BLANK_SPOT, 25);
  assert.equal(res.body.catatan.length, 0);
});

test('simulasi: validasi input', async () => {
  setupDb();
  const run = async (body) => { let err; await createScenario({ body }, mockRes(), (e) => { err = e; }); return err; };
  assert.equal((await run({})).status, 400);
  assert.equal((await run({ id_wilayah: 1, nama_scenario: 'x', tipe_intervensi: 'Aneh' })).status, 400);
  assert.equal((await run({ id_wilayah: 1, nama_scenario: 'x', parameter_json: { sekolah_baru: 999 } })).status, 400);
  assert.equal((await run({ id_wilayah: 1, parameter_json: { guru: 3 } })).status, 400); // simpan tanpa nama
});

test('simulasi: wilayah yang belum dihitung -> 409', async () => {
  fakePool.__next = async (text) => (/MAX\(tahun\)/.test(text) ? { rows: [{ t: 2026 }] } : { rows: [] });
  let err;
  await createScenario({ body: { id_wilayah: 1, simpan: false } }, mockRes(), (e) => { err = e; });
  assert.equal(err.status, 409);
});
