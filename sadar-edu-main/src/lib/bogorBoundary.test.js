import { test } from "node:test";
import assert from "node:assert/strict";
import { isInBogor, BOGOR_BOUNDARY } from "./bogorBoundary.js";

test("cakupan kabupaten mencakup Cibinong dan Leuwiliang", () => {
  assert.equal(isInBogor([106.854, -6.479]), true);
  assert.equal(isInBogor([106.635, -6.574]), true);
});

test("Kota Bogor masuk cakupan; Depok dan Jakarta tetap di luar", () => {
  assert.equal(isInBogor([106.824, -6.402]), false);
  assert.equal(isInBogor([106.798, -6.597]), true);
  assert.equal(isInBogor([106.845, -6.208]), false);
  assert.equal(isInBogor(null), false);
  assert.equal(isInBogor([NaN, -6.5]), false);
});

test("batas gabungan kabupaten dan kota tertutup tanpa lubang kota", () => {
  assert.deepEqual(BOGOR_BOUNDARY.properties.codes, ["32.01", "32.71"]);
  assert.equal(BOGOR_BOUNDARY.geometry.coordinates.length, 1);
  for (const ring of BOGOR_BOUNDARY.geometry.coordinates) assert.deepEqual(ring[0], ring.at(-1));
});
