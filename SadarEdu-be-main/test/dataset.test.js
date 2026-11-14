require('./helpers/stubDeps');
const test = require('node:test');
const assert = require('node:assert/strict');
const { _internal: I, KATEGORI } = require('../src/services/datasetService');

test('num: format Indonesia vs desimal Inggris vs number JS', () => {
  assert.equal(I.num('1.250'), 1250);
  assert.equal(I.num('1.250.000'), 1250000);
  assert.equal(I.num('3,5'), 3.5);
  assert.equal(I.num('1.250,75'), 1250.75);
  assert.equal(I.num('3.5'), 3.5); // bukan 35
  assert.equal(I.num(3.5), 3.5);
  assert.equal(I.num(''), null);
  assert.equal(I.num('abc'), null);
  assert.equal(I.num(null), null);
});

test('dec: koordinat desimal', () => {
  assert.equal(I.dec('-6,5944'), -6.5944);
  assert.equal(I.dec('106.8'), 106.8);
  assert.equal(I.dec(undefined), null);
});

test('pick: alias tidak peka huruf besar/kecil, lewati kosong', () => {
  assert.equal(I.pick({ WADMKC: 'Ciawi', nama: '' }, ['nama', 'wadmkc']), 'Ciawi');
  assert.equal(I.pick({ a: 1 }, ['b']), undefined);
  assert.equal(I.pick(null, ['b']), undefined);
});

test('toPointRecords: GeoJSON Point, CSV, dan array JSON menghasilkan koordinat yang sama', () => {
  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { npsn: '1' }, geometry: { type: 'Point', coordinates: [106.8, -6.6] } }] };
  const fromGj = I.toPointRecords(gj);
  const fromStr = I.toPointRecords(JSON.stringify(gj));
  const fromCsv = I.toPointRecords('npsn,latitude,longitude\n1,-6.6,106.8\n');
  const fromCsvSemi = I.toPointRecords('npsn;lat;lng\n1;-6,6;106,8\n');
  const fromArr = I.toPointRecords([{ npsn: '1', lat: -6.6, lng: 106.8 }]);
  [fromGj, fromStr, fromCsv, fromCsvSemi, fromArr].forEach((r) => {
    assert.equal(r.length, 1);
    assert.equal(r[0].lng, 106.8);
    assert.equal(r[0].lat, -6.6);
  });
});

test('toFeatures: menolak input yang bukan FeatureCollection', () => {
  assert.throws(() => I.toFeatures('bukan json'), /GeoJSON/);
  assert.throws(() => I.toFeatures({ type: 'Polygon' }), /FeatureCollection/);
  assert.equal(I.toFeatures({ type: 'Feature', geometry: null }).length, 1);
});

test('KATEGORI: tabel tujuan sesuai skema dan layer constraint berbagi tabel', () => {
  assert.equal(KATEGORI.risiko_bencana.tabel, 'layer_constraint');
  assert.equal(KATEGORI.lereng.tabel, 'layer_constraint');
  assert.equal(KATEGORI.sekolah.memengaruhiAnalisis, true);
  assert.equal(KATEGORI.jalan.memengaruhiAnalisis, false);
});

test('autoKode: selalu muat di VARCHAR(20) dan deterministik', () => {
  const k = I.autoKode('Kecamatan', 'Gunung Sindur Panjang Sekali Namanya');
  assert.ok(k.length <= 20, k);
  assert.equal(k, I.autoKode('Kecamatan', 'Gunung Sindur Panjang Sekali Namanya'));
  assert.match(k, /^AUTO-K-/);
});
