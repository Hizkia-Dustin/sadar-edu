const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV } = require('../src/utils/csv');

test('parseCSV: header, kutip, koma di dalam kutip, CRLF, baris kosong', () => {
  const rows = parseCSV('npsn,nama,alamat\r\n123,"SMPN 1, Bogor","Jl. ""Raya"" 1"\r\n\r\n456,SMPN 2,Jl. B\r\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { npsn: '123', nama: 'SMPN 1, Bogor', alamat: 'Jl. "Raya" 1' });
  assert.equal(rows[1].nama, 'SMPN 2');
});

test('parseCSV: pemisah titik-koma (ekspor Excel Indonesia) dan BOM', () => {
  const rows = parseCSV('\uFEFFkode_bps;tahun;jumlah_penduduk\n3201010;2024;120000\n');
  assert.deepEqual(rows[0], { kode_bps: '3201010', tahun: '2024', jumlah_penduduk: '120000' });
});

test('parseCSV: input kosong / bukan string', () => {
  assert.deepEqual(parseCSV(''), []);
  assert.deepEqual(parseCSV(null), []);
  assert.deepEqual(parseCSV('a,b\n'), []);
});
