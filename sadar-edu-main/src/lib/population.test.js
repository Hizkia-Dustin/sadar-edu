import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POPULATION_BANDS, populationColor } from './population.js';
import { isInBoundary } from './bogorBoundary.js';

test('warna jumlah penduduk memakai ambang tetap dan membedakan data kosong dari nol', () => {
  assert.equal(populationColor(74999), POPULATION_BANDS[0].color);
  for (const band of POPULATION_BANDS) assert.equal(populationColor(band.min), band.color);
  assert.equal(populationColor(376697), POPULATION_BANDS[4].color);
  for (const missing of [null, undefined, NaN, -1, '75000']) assert.equal(populationColor(missing), '#cbd5e1');
});

test('filter spasial mendukung multipoligon dan mengecualikan lubang', () => {
  const feature = { geometry: { type: 'MultiPolygon', coordinates: [
    [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
    [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]],
  ] } };
  assert.equal(isInBoundary([0.5, 0.5], feature), true);
  assert.equal(isInBoundary([1.5, 1.5], feature), false);
  assert.equal(isInBoundary([5.5, 5.5], feature), true);
  assert.equal(isInBoundary([4.5, 4.5], feature), false);
  assert.equal(isInBoundary([0, 2], feature), true);
});
