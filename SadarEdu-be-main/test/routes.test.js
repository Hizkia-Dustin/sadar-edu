const { routes, jwtStore } = require('./helpers/stubDeps');
const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/routes'); // gagal bila ada handler undefined / controller salah nama
const { requireRole, authenticateToken, signToken } = require('../src/middleware/auth');

const find = (method, path) => routes.find((r) => r.method === method && r.path === path);
const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const run = (handlers, req) => {
  const res = mockRes();
  let nextCalled = false;
  for (const h of handlers.slice(0, -1)) {
    nextCalled = false;
    h(req, res, () => { nextCalled = true; });
    if (!nextCalled) return { res, passed: false };
  }
  return { res, passed: true };
};

test('semua endpoint yang dijanjikan terdaftar', () => {
  const expected = [
    ['POST', '/login'], ['GET', '/prioritas'], ['GET', '/blank-spots'], ['POST', '/hitung'],
    ['POST', '/generate'], ['POST', '/import'], ['PUT', '/bobot'], ['POST', '/scenarios'],
    ['GET', '/geojson'], ['GET', '/:id/alternatif'], ['PUT', '/:id'], ['PATCH', '/:id'],
  ];
  expected.forEach(([m, p]) => assert.ok(find(m, p), `${m} ${p} tidak terdaftar`));
});

test('rute data kebijakan tidak dapat diakses tanpa token (401)', () => {
  ['/hitung', '/generate', '/scenarios', '/import', '/bobot'].forEach((path) => {
    ['POST', 'PUT'].forEach((m) => {
      const r = find(m, path);
      if (!r) return;
      const { res, passed } = run(r.handlers, { headers: {} });
      assert.equal(passed, false, `${m} ${path} harus ditolak`);
      assert.equal(res.statusCode, 401);
    });
  });
});

test('role: Umum ditolak (403), Stakeholder boleh simulasi tetapi tidak boleh impor dataset, Operator boleh impor', () => {
  const token = (role) => { const t = signToken({ id_user: 1, role }); return { headers: { authorization: `Bearer ${t}` } }; };

  const sim = find('POST', '/scenarios');
  assert.equal(run(sim.handlers, token('Umum')).res.statusCode, 403);
  assert.equal(run(sim.handlers, token('Stakeholder')).passed, true);
  assert.equal(run(sim.handlers, token('Operator')).passed, true);

  const imp = find('POST', '/import');
  assert.equal(run(imp.handlers, token('Stakeholder')).res.statusCode, 403);
  assert.equal(run(imp.handlers, token('Umum')).res.statusCode, 403);
  assert.equal(run(imp.handlers, token('operator')).passed, true); // tidak peka huruf besar/kecil
});

test('token tidak dikenal -> 401', () => {
  const res = mockRes();
  authenticateToken({ headers: { authorization: 'Bearer palsu' } }, res, () => assert.fail('tidak boleh lanjut'));
  assert.equal(res.statusCode, 401);
});

test('endpoint publik tidak butuh token', () => {
  ['/prioritas', '/blank-spots', '/coverage', '/ringkasan', '/list'].forEach((p) => {
    const r = find('GET', p);
    assert.ok(r, p);
    assert.equal(r.handlers.length, 1, `${p} seharusnya publik`);
  });
  assert.equal(find('GET', '/:id').handlers.length >= 1, true);
});

test('registrasi publik tidak bisa membuat Operator', async () => {
  const { fakePool } = require('./helpers/stubDeps');
  const { register } = require('../src/controllers/authController');
  const inserted = [];
  fakePool.__next = async (text, params) => {
    if (/SELECT id_user/.test(text)) return { rows: [] };
    if (/INSERT INTO user_account/.test(text)) { inserted.push(params); return { rows: [{ id_user: 1 }] }; }
    return { rows: [] };
  };
  const res = mockRes();
  await register({ body: { nama: 'X', email: 'x@y.id', password: 'password123', id_role: 3, role: 'Operator' } }, res, assert.ifError);
  assert.equal(res.statusCode, 201);
  assert.equal(inserted[0][3], 1, 'role harus dipaksa Umum (1)');
  fakePool.__next = null;
});

void jwtStore;
