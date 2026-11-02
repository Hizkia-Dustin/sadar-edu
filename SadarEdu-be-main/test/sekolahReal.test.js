require('./helpers/stubDeps');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { _internal: I } = require('../src/services/datasetService');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sekolah_sample.json'), 'utf8'));
const norm = (f, o = {}) => I.normalisasiSekolah(I.toPointRecords({ type: 'FeatureCollection', features: [f] })[0], { tahunDefault: 2025, ...o });

test('field camelCase data Dapodik dikenali & nilai ditipekan benar', () => {
  const r = norm(fx.features[0]);
  assert.equal(r.ok, true);
  assert.equal(r.row.npsn, '20231132'); // angka -> string
  assert.equal(r.row.nama, 'SMP PGRI KADUMANGGU');
  assert.equal(r.row.statistik.jumlah_siswa, 84);
  assert.equal(r.row.statistik.jumlah_guru, 4);
  assert.equal(r.row.statistik.jumlah_ruang_kelas, 6);
  assert.equal(r.row.statistik.ruang_kelas_rusak_ringan, 4);
  assert.equal(r.row.statistik.ruang_kelas_baik, 0); // 0 pada kolom kondisi adalah nol sungguhan
  assert.equal(r.row.kecamatan_asal, 'Babakan Madang'); // awalan "Kec. " dibuang
  assert.equal(r.row.kabupaten_kota, 'Kab. Bogor');
  assert.equal(r.row.desa_kelurahan, 'Kadumangu');
  assert.equal(r.row.tahun, 2025);
  assert.equal(r.row.lng, 106.8535);
  assert.equal(r.row.lat, -6.5405);
});

test('akreditasi "Tidak diisi" menjadi null, A/B/C dipertahankan', () => {
  assert.equal(norm(fx.features[0]).row.akreditasi, null);
  assert.equal(I.normAkreditasi('b'), 'B');
  assert.equal(I.normAkreditasi('Tidak diisi'), null);
  assert.equal(I.normAkreditasi(undefined), null);
});

test('nilai null/0 dibaca sebagai KOSONG, bukan nol (ruangKelas null, guru 0, siswa 0)', () => {
  const rows = fx.features.map((f) => ({ f, r: norm(f).row }));
  const nullKelas = rows.find((x) => x.f.properties.ruangKelas === null);
  assert.ok(nullKelas, 'fixture harus memuat ruangKelas null');
  assert.equal(nullKelas.r.statistik.jumlah_ruang_kelas, null);
  assert.equal(nullKelas.r.statistik.ruang_kelas_baik, null);
  const nolGuru = rows.find((x) => x.f.properties.jumlahGuru === 0);
  if (nolGuru) assert.equal(nolGuru.r.statistik.jumlah_guru, null);
  const nolSiswa = rows.find((x) => x.f.properties.jumlahSiswa === 0);
  if (nolSiswa) assert.equal(nolSiswa.r.statistik.jumlah_siswa, null);
  // dapat dimatikan bila Operator yakin nol itu nyata
  if (nolGuru) assert.equal(norm(nolGuru.f, { nolKosong: false }).row.statistik.jumlah_guru, 0);
});

test('sekolah Kota Bogor tetap terbaca dan ditandai kabupaten_kota-nya', () => {
  const kota = fx.features.find((f) => f.properties.kabupaten !== 'Kab. Bogor');
  assert.ok(kota);
  assert.equal(norm(kota).row.kabupaten_kota, 'Kota Bogor');
});

test('koordinat/NPSN/nama tidak valid ditolak dengan alasan', () => {
  const bad = { type: 'Feature', geometry: { type: 'Point', coordinates: [999, -6.5] }, properties: { npsn: 1, nama: 'X' } };
  assert.equal(norm(bad).ok, false);
  const noNpsn = { type: 'Feature', geometry: { type: 'Point', coordinates: [106.8, -6.5] }, properties: { nama: 'X' } };
  assert.equal(norm(noNpsn).ok, false);
});

test('SELURUH berkas asli (jika ada di mesin ini) terbaca tanpa baris ditolak', { skip: !fs.existsSync(process.env.SEKOLAH_REAL || '/mnt/user-data/uploads/SMPbogorSudahDiolah.json') }, () => {
  const real = JSON.parse(fs.readFileSync(process.env.SEKOLAH_REAL || '/mnt/user-data/uploads/SMPbogorSudahDiolah.json', 'utf8'));
  const recs = I.toPointRecords(real);
  const out = recs.map((r) => I.normalisasiSekolah(r, { tahunDefault: 2025 }));
  assert.equal(out.filter((o) => !o.ok).length, 0);
  assert.equal(new Set(out.map((o) => o.row.npsn)).size, recs.length, 'NPSN harus unik');
});
