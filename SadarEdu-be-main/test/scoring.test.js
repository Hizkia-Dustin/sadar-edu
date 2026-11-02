const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/services/scoring');
const cfg = require('../src/config/analysis');

const IND = S.INDIKATOR_DEFAULT;

const wilayahA = {
  // padat & kekurangan: 2 sekolah, 1800 siswa, 40 kelas (45 siswa/kelas), demand 2700*0.9=2430
  penduduk: 100000, penduduk_usia_smp: 2700, luas_km2: 30,
  jumlah_sekolah: 2, jumlah_siswa: 1800, jumlah_guru: 60, jumlah_rombel: 56, jumlah_ruang_kelas: 40,
  blank_pct: 60, jarak_terdekat_km: 4,
};
const wilayahB = {
  // memadai
  penduduk: 40000, penduduk_usia_smp: 1200, luas_km2: 40,
  jumlah_sekolah: 6, jumlah_siswa: 1000, jumlah_guru: 60, jumlah_rombel: 32, jumlah_ruang_kelas: 40,
  blank_pct: 5, jarak_terdekat_km: 0.8,
};
const wilayahC = {
  // tanpa sekolah
  penduduk: 20000, penduduk_usia_smp: 600, luas_km2: 50,
  jumlah_sekolah: 0, jumlah_siswa: 0, jumlah_guru: 0, jumlah_rombel: 0, jumlah_ruang_kelas: 0,
  blank_pct: 95, jarak_terdekat_km: 9,
};

test('bobot indikator default berjumlah 1', () => {
  const sum = IND.reduce((a, i) => a + i.bobot, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  IND.forEach((i) => assert.ok(i.kode_indikator.length <= 20, `${i.kode_indikator} melebihi VARCHAR(20)`));
});

test('deriveIndicators menghitung rasio dan gap dengan benar', () => {
  const r = S.deriveIndicators(wilayahA, cfg);
  assert.equal(r.RASIO_SISWA_KELAS, 45);
  assert.equal(r.RASIO_SISWA_GURU, 30);
  assert.equal(r.BEBAN_SISWA_SEKOLAH, 900);
  // kapasitas 40*32=1280; demand 2430; gap 1150 -> 47.33%
  assert.ok(Math.abs(r.GAP_KAPASITAS - (1150 / 2430) * 100) < 1e-9);
  assert.equal(r.AKSES_BLANK_SPOT, 60);
});

test('wilayah tanpa sekolah: rasio berbasis stok = null, gap 100%, beban = demand', () => {
  const r = S.deriveIndicators(wilayahC, cfg);
  assert.equal(r.RASIO_SISWA_KELAS, null);
  assert.equal(r.RASIO_SISWA_GURU, null);
  assert.equal(r.GAP_KAPASITAS, 100);
  assert.equal(r.BEBAN_SISWA_SEKOLAH, 540);
});

test('computeScores: wilayah kekurangan berperingkat lebih tinggi daripada yang memadai', () => {
  const { results } = S.computeScores(
    [{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }, { id: 'C', metrics: wilayahC }],
    IND
  );
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  assert.ok(byId.B.skor < byId.A.skor, 'B (memadai) harus lebih rendah dari A');
  assert.ok(byId.B.skor < byId.C.skor);
  assert.equal(byId.B.ranking, 3);
  assert.ok(byId.A.skor >= 0 && byId.A.skor <= 100);
  assert.equal(byId.B.kategori, 'Rendah');
});

test('computeScores: skor wilayah tanpa data rasio tetap terhitung (bobot dinormalkan ulang)', () => {
  const { results } = S.computeScores([{ id: 'A', metrics: wilayahA }, { id: 'C', metrics: wilayahC }], IND);
  const c = results.find((r) => r.id === 'C');
  assert.ok(Number.isFinite(c.skor));
  assert.equal(c.norm.RASIO_SISWA_KELAS, null);
  assert.equal(c.kontribusi.RASIO_SISWA_KELAS, 0);
});

test('computeScores: kontribusi menjumlah ke skor', () => {
  const { results } = S.computeScores([{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }], IND);
  results.forEach((r) => {
    const total = Object.values(r.kontribusi).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - r.skor) < 0.05, `${total} vs ${r.skor}`);
  });
});

test('computeScores: override bobot mengubah skor (what-if bobot MCDA)', () => {
  const rows = [{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }, { id: 'C', metrics: wilayahC }];
  const base = S.computeScores(rows, IND).results;
  const onlyAccess = S.computeScores(rows, IND, {
    weights: { GAP_KAPASITAS: 0, RASIO_SISWA_KELAS: 0, BEBAN_SISWA_SEKOLAH: 0, RASIO_SISWA_GURU: 0, KEPADATAN_USIA_SMP: 0, AKSES_BLANK_SPOT: 1, JARAK_SEKOLAH: 0 },
  }).results;
  const c = onlyAccess.find((r) => r.id === 'C');
  assert.equal(c.skor, 100); // blank spot tertinggi
  assert.notEqual(base.find((r) => r.id === 'C').skor, 100);
});

test('arah pengaruh Negatif membalik normalisasi', () => {
  const stat = { min: 0, max: 10 };
  assert.equal(S.normalizeValue(10, stat, 'Positif'), 1);
  assert.equal(S.normalizeValue(10, stat, 'Negatif'), 0);
  assert.equal(S.normalizeValue(20, stat, 'Positif'), 1); // clamp
  assert.equal(S.normalizeValue(null, stat), null);
  assert.equal(S.normalizeValue(5, { min: 5, max: 5 }), 0); // tanpa variasi
});

test('ranking: skor sama mendapat ranking sama', () => {
  const { results } = S.computeScores([{ id: 'X', metrics: wilayahA }, { id: 'Y', metrics: wilayahA }, { id: 'Z', metrics: wilayahB }], IND);
  const x = results.find((r) => r.id === 'X');
  const y = results.find((r) => r.id === 'Y');
  assert.equal(x.ranking, y.ranking);
  assert.equal(x.ranking, 1);
  assert.equal(results.find((r) => r.id === 'Z').ranking, 3);
});

test('categorize memakai ambang config', () => {
  assert.equal(S.categorize(80), 'Sangat Tinggi');
  assert.equal(S.categorize(75), 'Sangat Tinggi');
  assert.equal(S.categorize(60), 'Tinggi');
  assert.equal(S.categorize(40), 'Sedang');
  assert.equal(S.categorize(10), 'Rendah');
  assert.equal(S.categorize(null), null);
});

test('diagnose menyebut masalah nyata dan tidak mengarang', () => {
  const { results } = S.computeScores([{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }], IND);
  const a = results.find((r) => r.id === 'A');
  const d = S.diagnose({ nama: 'Kec. A', metrics: wilayahA, kontribusi: a.kontribusi, indikator: IND });
  assert.ok(d.masalah.includes('KELAS_PADAT'));
  assert.ok(d.masalah.includes('GURU_KURANG'));
  assert.ok(d.masalah.includes('KAPASITAS_KURANG'));
  assert.ok(d.masalah.includes('AKSES_TERBATAS'));
  assert.ok(d.ringkasan.startsWith('Kec. A:'));
  assert.equal(d.faktor_utama.length, 3);

  const b = results.find((r) => r.id === 'B');
  const db = S.diagnose({ nama: 'Kec. B', metrics: wilayahB, kontribusi: b.kontribusi, indikator: IND });
  assert.deepEqual(db.masalah, []);
  assert.match(db.ringkasan, /memadai/);
});

test('recommendIntervensi: tanpa sekolah -> sekolah baru; kelas padat -> tambah kelas', () => {
  const c = S.recommendIntervensi(wilayahC);
  assert.equal(c[0].tipe, 'Sekolah Baru');
  const a = S.recommendIntervensi(wilayahA);
  const tipe = a.map((x) => x.tipe);
  assert.ok(tipe.includes('Sekolah Baru')); // gap 1150 >= 288, blank 60% >= 50
  assert.ok(tipe.includes('Penambahan Ruang Kelas'));
  assert.ok(tipe.includes('Penambahan Guru'));
  const kelas = a.find((x) => x.tipe === 'Penambahan Ruang Kelas');
  assert.equal(kelas.jumlah, Math.ceil(1800 / 32) - 40); // 57-40 = 17
  const b = S.recommendIntervensi(wilayahB);
  assert.equal(b[0].tipe, 'Pemantauan Berkala');
});

test('simulate: tambah sekolah menurunkan gap & skor; tanpa lokasi aksesibilitas tidak berubah', () => {
  const rows = [{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }, { id: 'C', metrics: wilayahC }];
  const { stats } = S.computeScores(rows, IND);
  const sim = S.simulate({ metrics: wilayahA, skenario: { sekolah_baru: 2 }, indikator: IND, stats });
  assert.equal(sim.tambahan.ruang_kelas, 18);
  assert.equal(sim.tambahan.kapasitas_kursi, 18 * 32);
  assert.ok(sim.after.gap_kursi < sim.before.gap_kursi);
  assert.ok(sim.after.skor < sim.before.skor);
  assert.equal(sim.after.indikator.AKSES_BLANK_SPOT, sim.before.indikator.AKSES_BLANK_SPOT);
  assert.ok(sim.perubahan.skor < 0);
});

test('simulate: skor "sebelum" identik dengan skor hasil computeScores', () => {
  const rows = [{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }, { id: 'C', metrics: wilayahC }];
  const { results, stats } = S.computeScores(rows, IND);
  const sim = S.simulate({ metrics: wilayahA, skenario: {}, indikator: IND, stats });
  assert.equal(sim.before.skor, results.find((r) => r.id === 'A').skor);
  assert.equal(sim.perubahan.skor, 0);
});

test('simulate: efek lokasi (blank_pct_after) menurunkan skor aksesibilitas', () => {
  const rows = [{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }, { id: 'C', metrics: wilayahC }];
  const { stats } = S.computeScores(rows, IND);
  const noLoc = S.simulate({ metrics: wilayahA, skenario: { sekolah_baru: 1 }, indikator: IND, stats });
  const withLoc = S.simulate({ metrics: wilayahA, skenario: { sekolah_baru: 1, blank_pct_after: 20, jarak_after: 1 }, indikator: IND, stats });
  assert.ok(withLoc.after.skor < noLoc.after.skor);
});

test('simulate: serap_kebutuhan=false menahan jumlah siswa', () => {
  const rows = [{ id: 'A', metrics: wilayahA }, { id: 'B', metrics: wilayahB }];
  const { stats } = S.computeScores(rows, IND);
  const s1 = S.simulate({ metrics: wilayahA, skenario: { ruang_kelas: 10 }, indikator: IND, stats });
  const s2 = S.simulate({ metrics: wilayahA, skenario: { ruang_kelas: 10, serap_kebutuhan: false }, indikator: IND, stats });
  assert.equal(s2.after.metrik.jumlah_siswa, 1800);
  assert.ok(s1.after.metrik.jumlah_siswa > 1800);
  assert.ok(s2.after.indikator.RASIO_SISWA_KELAS < s1.after.indikator.RASIO_SISWA_KELAS);
});

const ctxLengkap = {
  tersedia: { jalan: true, risiko_bencana: true, lereng: true, kawasan_lindung: true },
  bobot: cfg.BOBOT_KANDIDAT,
  batas: cfg.KANDIDAT,
  radiusKm: 3,
};

test('scoreKandidat: sel ideal berskor tinggi dan layak', () => {
  const r = S.scoreKandidat({ d_sekolah_km: 3.5, d_jalan_km: 0, risiko: 0, lereng: 0, di_kawasan_lindung: false, skor_wilayah: 100 }, ctxLengkap);
  assert.equal(r.layak, true);
  assert.equal(r.skor, 100);
});

test('scoreKandidat: aturan eksklusi', () => {
  const base = { d_sekolah_km: 3, d_jalan_km: 0.2, risiko: 1, lereng: 5, di_kawasan_lindung: false, skor_wilayah: 80 };
  assert.equal(S.scoreKandidat({ ...base, d_sekolah_km: 0.4 }, ctxLengkap).layak, false);
  assert.equal(S.scoreKandidat({ ...base, risiko: 4 }, ctxLengkap).layak, false);
  assert.equal(S.scoreKandidat({ ...base, risiko: 3 }, ctxLengkap).layak, true);
  assert.equal(S.scoreKandidat({ ...base, lereng: 30 }, ctxLengkap).layak, false);
  assert.equal(S.scoreKandidat({ ...base, di_kawasan_lindung: true }, ctxLengkap).layak, false);
});

test('scoreKandidat: layer yang tidak tersedia dilewati, bobot dinormalkan ulang', () => {
  const ctx = { ...ctxLengkap, tersedia: { jalan: false, risiko_bencana: false, lereng: false, kawasan_lindung: false } };
  // hanya jarak_sekolah (0.3) & prioritas_wilayah (0.2) yang aktif
  const r = S.scoreKandidat({ d_sekolah_km: 3, d_jalan_km: null, risiko: null, lereng: null, di_kawasan_lindung: false, skor_wilayah: 50 }, ctx);
  assert.equal(r.layak, true);
  assert.equal(r.komponen.akses_jalan, null);
  // (0.3*1 + 0.2*0.5)/0.5 = 0.8
  assert.equal(r.skor, 80);
});

test('pickTopKandidat: batas per wilayah & jarak minimum antar-kandidat', () => {
  const mk = (id, id_wilayah, lng, lat, skor, layak = true) => ({ id, id_wilayah, lng, lat, skor, layak });
  const cells = [
    mk(1, 'A', 106.80, -6.60, 90),
    mk(2, 'A', 106.801, -6.60, 89), // terlalu dekat dengan #1 (~0.11 km)
    mk(3, 'A', 106.83, -6.60, 85),
    mk(4, 'A', 106.86, -6.60, 80),
    mk(5, 'A', 106.89, -6.60, 75), // ke-4 di wilayah A -> ditolak (maks 3)
    mk(6, 'B', 106.80, -6.70, 70),
    mk(7, 'B', 106.80, -6.75, 99, false), // tidak layak
  ];
  const top = S.pickTopKandidat(cells, { topN: 10, maxPerWilayah: 3, minSeparationKm: 1.5 });
  assert.deepEqual(top.map((c) => c.id), [1, 3, 4, 6]);
  const top2 = S.pickTopKandidat(cells, { topN: 2 });
  assert.equal(top2.length, 2);
});

// ---- Kelengkapan data (data sekolah nyata sering kosong) ----
const wilayahLengkap = { penduduk_usia_smp: 1000, luas_km2: 20, jumlah_sekolah: 3, jumlah_siswa: 900, jumlah_guru: 45, jumlah_ruang_kelas: 30, blank_pct: 10, jarak_terdekat_km: 1 };
const wilayahBolong = {
  // sekolah ke-3 (siswa 300) tidak punya data ruang kelas & guru; stok sekolah lain sama persis dengan wilayahLengkap
  ...wilayahLengkap, jumlah_siswa: 900, jumlah_ruang_kelas: 20, jumlah_guru: 30,
  siswa_dgn_kelas: 600, siswa_tanpa_data_kelas: 300, siswa_dgn_guru: 600, sekolah_ada_siswa: 3,
  sekolah_tanpa_data_kelas: 1, sekolah_tanpa_data_guru: 1,
};

test('data kosong bukan nol: rasio siswa/kelas & siswa/guru tidak digelembungkan', () => {
  const naif = S.deriveIndicators({ ...wilayahBolong, siswa_dgn_kelas: undefined, siswa_tanpa_data_kelas: undefined, siswa_dgn_guru: undefined }); // membaca kosong sebagai nol
  const benar = S.deriveIndicators(wilayahBolong);
  assert.equal(naif.RASIO_SISWA_KELAS, 45); // 900/20 -> salah
  assert.equal(benar.RASIO_SISWA_KELAS, 30); // 600/20
  assert.equal(benar.RASIO_SISWA_GURU, 20); // 600/30
});

test('data kosong: kapasitas sekolah tanpa data kelas dianggap netral (setara siswa)', () => {
  assert.equal(S.kapasitasOf(wilayahBolong, cfg), 20 * 32 + 300);
  // wilayah lengkap: 30 kelas x 32 = 960 >= 900 -> tidak ada gap; wilayah bolong tidak boleh terlihat lebih buruk
  assert.equal(S.gapKursiOf(wilayahLengkap, cfg), Math.max(0, 900 - 960));
  const gBolong = S.deriveIndicators(wilayahBolong, cfg).GAP_KAPASITAS;
  const gLengkap = S.deriveIndicators(wilayahLengkap, cfg).GAP_KAPASITAS;
  assert.ok(gBolong <= gLengkap + 1e-9 || gBolong < 10, `gap bolong ${gBolong} vs lengkap ${gLengkap}`);
});

test('diagnosis menyebut kelengkapan data bila ada sekolah tanpa data', () => {
  const { results } = S.computeScores([{ id: 1, metrics: wilayahBolong }, { id: 2, metrics: wilayahLengkap }], IND);
  const r = results.find((x) => x.id === 1);
  const d = S.diagnose({ nama: 'X', metrics: wilayahBolong, kontribusi: r.kontribusi, indikator: IND });
  assert.equal(d.catatan_data.length, 2);
  assert.match(d.catatan_data[0], /1 dari 3 sekolah/);
  const d2 = S.diagnose({ nama: 'Y', metrics: wilayahLengkap, kontribusi: r.kontribusi, indikator: IND });
  assert.deepEqual(d2.catatan_data, []);
});

test('simulasi pada metrik dengan data kosong tetap konsisten (sebelum = skor tersimpan)', () => {
  const rows = [{ id: 1, metrics: wilayahBolong }, { id: 2, metrics: wilayahLengkap }];
  const { results, stats } = S.computeScores(rows, IND);
  const sim = S.simulate({ metrics: wilayahBolong, skenario: { ruang_kelas: 5 }, indikator: IND, stats });
  assert.equal(sim.before.skor, results.find((x) => x.id === 1).skor);
  assert.ok(sim.after.metrik.siswa_dgn_kelas >= wilayahBolong.siswa_dgn_kelas);
  const baru = S.simulate({ metrics: wilayahBolong, skenario: { sekolah_baru: 1 }, indikator: IND, stats });
  assert.equal(baru.after.metrik.sekolah_ada_siswa, 4);
});
