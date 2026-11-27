const test = require('node:test');
const assert = require('node:assert/strict');
const { staffingRequest, schoolStaffingReply } = require('../src/services/schoolStaffing');
const db = require('../src/config/db');

test('membedakan pertanyaan kecamatan, daftar SMP, dan rincian lanjutan', () => {
  const previous = { question: 'Wilayah mana yang butuh guru?', summary: 'Beban guru tertinggi di Sukajaya.' };
  assert.equal(staffingRequest('Kecamatan mana yang butuh guru SMP?', previous), null);
  assert.ok(staffingRequest('list smp yang membutuhkan guru'));
  assert.ok(staffingRequest('SMP mana di kecamatan tadi?', previous));
  assert.equal(staffingRequest('Sekolah mana yang kelasnya rusak?', previous), null);
});

test('rujukan nomor mengambil ulang statistik sekolah dengan ID dari jawaban sebelumnya', async t => {
  const last = { topic: 'guru_sekolah', schoolIds: [77, 83] };
  t.mock.method(db, 'query', async (_sql, params) => {
    assert.deepEqual(params, [[5], 2026, null, 83]);
    return { rows: [{ id_sekolah: 83, nama_sekolah: 'SMP uji', nama_wilayah: 'Tenjo', id_wilayah: 5,
      jumlah_siswa: 200, jumlah_guru: 8, rasio: 25, tahun: 2025 }] };
  });
  const result = await schoolStaffingReply({ districtIds: [5], scopeName: 'Tenjo', year: 2026,
    last, request: staffingRequest('Rinci yang kedua', last) });
  assert.equal(result.schools[0].id, 83);
  assert.match(result.schools[0].detail, /25 siswa\/guru · 2025/);
});
