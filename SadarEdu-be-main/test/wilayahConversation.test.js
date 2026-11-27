const test = require('node:test');
const assert = require('node:assert/strict');
const { answerQuestion } = require('../src/services/wilayahConversation');

test('pertanyaan lanjutan tentang perbaikan skor tetap mendapat usulan wilayah ketika model offline', async t => {
  t.mock.method(global, 'fetch', async () => { throw new Error('offline'); });
  const context = {
    history: [], previousTopic: 'prioritas', meta: { tahun: 2024, indikator: [] }, base: {},
    properties: { nama_wilayah: 'Sukajaya', rekomendasi: { intervensi: [
      { tipe: 'Penambahan Ruang Kelas', alasan: 'Kelas yang tersedia sudah padat.' },
    ] } },
  };
  for (const question of ['apa yang saya bisa lakukan ??', 'apa yan gsaya bsia lakukan untuk memperbaiki skor ini']) {
    const answer = await answerQuestion({ ...context, question });
    assert.equal(answer.topic, 'tindakan');
    assert.match(answer.summary, /Simulasi & Lahan/);
    assert.match(answer.evidence[0], /Kelas yang tersedia sudah padat/);
  }
  const budget = await answerQuestion({ ...context, question: 'Berapa anggarannya?' });
  assert.match(budget.summary, /belum memuat biaya/);
});

test('pertanyaan analisis seluruh peta (kek mana peta yang kuran sekola) menghasilkan highlight wilayah, comparison, dan action chips', async t => {
  t.mock.method(global, 'fetch', async () => { throw new Error('offline'); });
  const allRanked = [
    { id: 68, nama: 'Nanggung', ranking: 1, skor: 77.95, kategori: 'Sangat Tinggi', blank_pct: 43.2, rusak_total: 31, rusak_berat: 12, sekolah_total: 14 },
    { id: 74, nama: 'Sukajaya', ranking: 2, skor: 68.16, kategori: 'Tinggi', blank_pct: 27.9, rusak_total: 28, rusak_berat: 10, sekolah_total: 6 },
    { id: 73, nama: 'Rumpin', ranking: 3, skor: 47.17, kategori: 'Sedang', blank_pct: 0, rusak_total: 62, rusak_berat: 25, sekolah_total: 28 },
  ];
  const context = {
    history: [], previousTopic: null, meta: { tahun: 2026, indikator: [] }, base: {},
    properties: null, allRanked,
  };
  const answer = await answerQuestion({ ...context, question: 'kek mana peta yang kuran sekola' });
  assert.equal(answer.topic, 'prioritas');
  assert.match(answer.summary, /Nanggung/);
  assert.match(answer.summary, /Sukajaya/);
  assert.ok(Array.isArray(answer.highlight_wilayah));
  assert.ok(answer.highlight_wilayah.includes(68));
  assert.ok(answer.highlight_wilayah.includes(74));
  assert.ok(Array.isArray(answer.comparison) && answer.comparison.length >= 2);
  assert.ok(Array.isArray(answer.action_chips) && answer.action_chips.length > 0);
  assert.equal(answer.action_chips[0].wilayahId, 68);
});

test('perbandingan dua kecamatan menyorot kedua wilayah sekaligus dan menghasilkan kartu perbandingan', async t => {
  t.mock.method(global, 'fetch', async () => { throw new Error('offline'); });
  const allRanked = [
    { id: 68, nama: 'Nanggung', ranking: 1, skor: 77.95, kategori: 'Sangat Tinggi', blank_pct: 43.2, rusak_total: 31, rusak_berat: 12, sekolah_total: 14, sekolah_negeri: 3, sekolah_swasta: 11, gap_kursi: 500, rekomendasi: [{ tipe: 'Sekolah Baru', jumlah: 1, alasan: 'Blank spot tinggi' }] },
    { id: 73, nama: 'Rumpin', ranking: 3, skor: 47.17, kategori: 'Sedang', blank_pct: 0, rusak_total: 62, rusak_berat: 25, sekolah_total: 28, sekolah_negeri: 5, sekolah_swasta: 23, gap_kursi: 120, rekomendasi: [{ tipe: 'Rehabilitasi Ruang Kelas', jumlah: 25, alasan: 'Banyak kelas rusak berat' }] },
  ];
  const answer = await answerQuestion({
    question: 'bandingkan Nanggung dan Rumpin',
    allRanked,
    focusDistrictIds: [68, 73],
    properties: null,
    meta: { tahun: 2026, indikator: [] },
    base: {},
  });
  assert.deepEqual(answer.highlight_wilayah, [68, 73]);
  assert.equal(answer.comparison.length, 2);
  assert.match(answer.summary, /Nanggung/);
  assert.match(answer.summary, /Rumpin/);
  assert.ok(answer.action_chips.some(c => c.action === 'simulate' && c.wilayahId === 68));
});

test('parsing respons JSON terstruktur Gemini menghasilkan metrics, comparison, follow_ups, dan sanitasi action_chips', async t => {
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  t.after(() => {
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
  });

  t.mock.method(global, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              headline: 'Prioritas USB vs Rehabilitasi Kelas',
              summary: '**Kec. Nanggung** paling mendesak untuk pembangunan USB (blank spot **43,2%**), sedangkan **Kec. Rumpin** membutuhkan rehabilitasi (**62 kelas rusak**).',
              metrics: [{ label: 'Blank Spot Nanggung', value: '43,2%', tone: 'danger' }],
              comparison: [
                { wilayahId: 68, wilayah: 'Nanggung', badge: 'Skor 78,0 · Sangat Tinggi', detail: 'Blank spot 43,2% · 31 kelas rusak' },
                { wilayahId: 73, wilayah: 'Rumpin', badge: 'Skor 47,2 · Sedang', detail: '62 kelas rusak (25 berat)' },
              ],
              recommendation: 'Bangun 1 USB di Nanggung dan rehab 25 kelas rusak berat di Rumpin.',
              highlight_wilayah: [68, 73, 999999],
              primary_wilayah: { id: 68, name: 'Nanggung' },
              suggested_layers: ['mcdaLayer', 'showBlankSpots', 'invalidLayer'],
              action_chips: [
                { label: '🧪 Simulasi USB Nanggung', action: 'simulate', wilayahId: 68, tipe: 'Sekolah Baru', jumlah: 1 },
                { label: '🗺️ Buka Blank Spot', layer: 'showBlankSpots' },
              ],
              follow_ups: ['Sekolah mana di Rumpin yang kelasnya rusak berat?'],
              evidence: ['Nanggung memiliki blank spot 43,2%.'],
              topic: 'prioritas',
            }),
          }],
        },
      }],
    }),
  }));

  const allRanked = [
    { id: 68, nama: 'Nanggung', ranking: 1, skor: 78.0, kategori: 'Sangat Tinggi', blank_pct: 43.2, rusak_total: 31 },
    { id: 73, nama: 'Rumpin', ranking: 3, skor: 47.2, kategori: 'Sedang', blank_pct: 0, rusak_total: 62 },
  ];
  const answer = await answerQuestion({
    question: 'bandingkan kebutuhan sekolah baru vs renovasi',
    allRanked,
    properties: null,
    meta: { tahun: 2026, indikator: [] },
    base: {},
  });
  assert.equal(answer.source, 'Gemini · Analis Spasial SADAR EDU');
  assert.equal(answer.headline, 'Prioritas USB vs Rehabilitasi Kelas');
  assert.deepEqual(answer.highlight_wilayah, [68, 73]);
  assert.deepEqual(answer.suggested_layers, ['mcdaLayer', 'showBlankSpots']);
  assert.equal(answer.metrics.length, 1);
  assert.equal(answer.comparison.length, 2);
  assert.equal(answer.action_chips[0].action, 'simulate');
  assert.equal(answer.follow_ups.length, 1);
});

test('pertanyaan prioritas rendah (termasuk typo) menyorot kecamatan kategori Rendah, bukan Nanggung', async t => {
  t.mock.method(global, 'fetch', async () => { throw new Error('offline'); });
  const allRanked = [
    { id: 68, nama: 'Nanggung', ranking: 1, skor: 78.0, kategori: 'Sangat Tinggi', blank_pct: 43.2, rusak_total: 31, rusak_berat: 8, sekolah_total: 20, sekolah_negeri: 8, sekolah_swasta: 12 },
    { id: 43, nama: 'Bojong Gede', ranking: 44, skor: 18.3, kategori: 'Rendah', blank_pct: 0, rusak_total: 65, rusak_berat: 10, sekolah_total: 66, sekolah_negeri: 15, sekolah_swasta: 51 },
    { id: 60, nama: 'Gunung Sindur', ranking: 45, skor: 17.0, kategori: 'Rendah', blank_pct: 0, rusak_total: 36, rusak_berat: 5, sekolah_total: 30, sekolah_negeri: 9, sekolah_swasta: 21 },
    { id: 59, nama: 'Gunung Putri', ranking: 46, skor: 12.9, kategori: 'Rendah', blank_pct: 0, rusak_total: 112, rusak_berat: 4, sekolah_total: 89, sekolah_negeri: 17, sekolah_swasta: 72 },
  ];
  const answer = await answerQuestion({
    question: 'wilayang yang memiliki priotitas rendah coba analisis',
    allRanked,
    properties: null,
    meta: { tahun: 2026, indikator: [] },
    base: {},
  });
  assert.match(answer.headline, /Prioritas Rendah/i);
  assert.match(answer.summary, /Gunung Putri/);
  assert.ok(!answer.highlight_wilayah.includes(68), 'tidak boleh menyorot Nanggung saat ditanya prioritas rendah');
  assert.ok(answer.highlight_wilayah.includes(59));
});
