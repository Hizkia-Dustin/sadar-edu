/**
 * Pengganti modul pihak ketiga agar kode aplikasi dapat dimuat di lingkungan uji
 * tanpa PostgreSQL. Hanya dipakai oleh tes; tidak mengubah kode produksi.
 */
const Module = require('module');

const realLoad = Module._load;
const calls = [];

const fakePool = {
  query: async (text, params) => {
    calls.push({ text, params });
    return fakePool.__next ? fakePool.__next(text, params) : { rows: [], rowCount: 0 };
  },
  connect: async () => ({ query: fakePool.query, release() {} }),
  on() {},
};

const routes = [];
function makeRouter() {
  const r = { stack: [], mw: [] };
  ['get', 'post', 'put', 'patch', 'delete'].forEach((m) => {
    r[m] = (path, ...handlers) => {
      handlers.flat().forEach((h) => {
        if (typeof h !== 'function') throw new Error(`Handler bukan fungsi pada ${m.toUpperCase()} ${path}`);
      });
      routes.push({ method: m.toUpperCase(), path, handlers: [...r.mw, ...handlers.flat()] });
    };
  });
  r.use = (...args) => {
    args.flat().forEach((h) => {
      if (typeof h !== 'function' && typeof h !== 'string' && !(h && h.stack)) throw new Error('use() menerima argumen tidak valid');
      if (typeof h === 'function') r.mw.push(h); // middleware tingkat router berlaku untuk rute sesudahnya
    });
  };
  return r;
}
const express = () => ({ use() {}, get() {}, listen() {} });
express.Router = makeRouter;
express.json = () => () => {};
express.urlencoded = () => () => {};

const jwtStore = {};
const stubs = {
  express,
  helmet: () => () => {},
  cors: () => () => {},
  morgan: () => () => {},
  bcryptjs: { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` },
  jsonwebtoken: {
    sign: (payload) => { const t = `tok${Object.keys(jwtStore).length}`; jwtStore[t] = payload; return t; },
    verify: (t) => { if (!jwtStore[t]) throw new Error('bad'); return jwtStore[t]; },
  },
  pg: { Pool: function Pool() { return fakePool; }, types: { setTypeParser() {} } },
  dotenv: { config() {} },
};

Module._load = function (request, parent, isMain) {
  if (stubs[request]) return stubs[request];
  return realLoad.call(this, request, parent, isMain);
};

module.exports = { fakePool, calls, stubs, routes, jwtStore };
