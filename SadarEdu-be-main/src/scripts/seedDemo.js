/**
 * Mengisi database dengan DATA DEMO SINTETIS untuk Kabupaten Bogor agar seluruh fitur dapat dicoba
 * sebelum dataset resmi (BPS, BIG, BNPB, Disdik) siap.
 *
 * PENTING: batas kecamatan dibuat dari poligon Voronoi di sekitar titik pusat perkiraan, jumlah
 * penduduk/sekolah/siswa dibangkitkan acak-deterministik. Ini BUKAN data resmi dan tidak boleh
 * dipakai untuk keputusan. Setiap dataset diberi sumber "DEMO ..." sehingga FE menampilkan banner.
 *
 * Pemakaian:  npm run seed:demo            (idempotent: menghapus dataset DEMO lama lalu membuat ulang)
 */
require('dotenv').config();
const db = require('../config/db');
const dataset = require('../services/datasetService');
const analysis = require('../services/analysisService');
const candidates = require('../services/candidateService');
const seedIndikator = require('../config/seedIndikator');
const seedRoles = require('../config/seedRoles');

const SUMBER = 'DEMO — data sintetis, bukan data resmi';
const TAHUN = new Date().getFullYear();

// [nama, lng, lat, populasi (ribu jiwa, perkiraan ilustratif), tipe: 'U' perkotaan | 'D' pinggiran | 'R' pedesaan]
const KECAMATAN = [
  ['Tenjo', 106.46, -6.35, 75, 'R'], ['Parungpanjang', 106.55, -6.35, 120, 'D'], ['Jasinga', 106.46, -6.48, 95, 'R'],
  ['Cigudeg', 106.52, -6.5, 120, 'R'], ['Sukajaya', 106.47, -6.58, 60, 'R'], ['Nanggung', 106.5, -6.64, 80, 'R'],
  ['Rumpin', 106.59, -6.41, 130, 'D'], ['Gunung Sindur', 106.68, -6.38, 130, 'D'], ['Parung', 106.72, -6.42, 125, 'D'],
  ['Ciseeng', 106.68, -6.46, 100, 'D'], ['Kemang', 106.76, -6.5, 110, 'D'], ['Rancabungur', 106.72, -6.54, 60, 'D'],
  ['Tajurhalang', 106.78, -6.45, 95, 'D'], ['Bojonggede', 106.8, -6.49, 350, 'U'], ['Cibinong', 106.84, -6.48, 400, 'U'],
  ['Sukaraja', 106.85, -6.58, 270, 'U'], ['Citeureup', 106.88, -6.48, 260, 'U'], ['Gunung Putri', 106.92, -6.45, 440, 'U'],
  ['Cileungsi', 106.97, -6.4, 380, 'U'], ['Klapanunggal', 106.99, -6.48, 140, 'D'], ['Jonggol', 107.05, -6.48, 170, 'D'],
  ['Cariu', 107.15, -6.52, 80, 'R'], ['Tanjungsari', 107.15, -6.58, 55, 'R'], ['Sukamakmur', 107.07, -6.6, 95, 'R'],
  ['Babakan Madang', 106.88, -6.57, 150, 'D'], ['Megamendung', 106.9, -6.64, 110, 'D'], ['Cisarua', 106.93, -6.68, 130, 'D'],
  ['Ciawi', 106.86, -6.66, 130, 'D'], ['Caringin', 106.84, -6.7, 120, 'R'], ['Cigombong', 106.8, -6.73, 110, 'R'],
  ['Cijeruk', 106.78, -6.68, 80, 'R'], ['Tamansari', 106.75, -6.64, 80, 'D'], ['Ciomas', 106.77, -6.6, 170, 'U'],
  ['Dramaga', 106.73, -6.58, 120, 'D'], ['Tenjolaya', 106.7, -6.65, 65, 'R'], ['Ciampea', 106.69, -6.55, 170, 'D'],
  ['Cibungbulang', 106.65, -6.58, 150, 'D'], ['Pamijahan', 106.65, -6.68, 150, 'R'], ['Leuwisadeng', 106.62, -6.56, 80, 'D'],
  ['Leuwiliang', 106.6, -6.58, 125, 'D'],
];

// Pembangkit acak deterministik (mulberry32) agar hasil seed selalu sama
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260901);
const between = (a, b) => a + (b - a) * rand();
const kode = (i) => `DEMO-${String(i + 1).padStart(2, '0')}`;

function circle(lng, lat, rKm, n = 24) {
  const dLat = rKm / 111.32;
  const dLng = rKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i < n; i += 1) {
    const a = (2 * Math.PI * i) / n;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

async function hapusDemoLama() {
  const lama = await db.query(`SELECT id_dataset FROM dataset_metadata WHERE sumber ILIKE 'DEMO%'`);
  if (lama.rows.length === 0) return;
  for (const r of lama.rows) await dataset.deleteDataset(r.id_dataset);
  // Skor/kandidat/skenario lama bergantung pada data demo: bersihkan agar konsisten (dihitung ulang di akhir)
  await db.query('DELETE FROM candidate_area');
  await db.query('DELETE FROM scenario_intervensi');
  await db.query('DELETE FROM priority_score');
  await db.query('DELETE FROM nilai_indikator');
  console.log(`🧹 ${lama.rows.length} dataset demo lama dihapus.`);
}

async function buatWilayah() {
  const seeds = KECAMATAN.map((k, i) => ({ kode: kode(i), nama: k[0], lng: k[1], lat: k[2] }));
  const r = await db.query(
    `WITH k AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(kode text, nama text, lng float8, lat float8)),
          pts AS (SELECT kode, nama, ST_SetSRID(ST_MakePoint(lng, lat), 4326) AS geom FROM k),
          hull AS (SELECT ST_Buffer(ST_ConvexHull(ST_Collect(geom))::geography, 7000)::geometry AS geom FROM pts),
          vor AS (SELECT (ST_Dump(ST_VoronoiPolygons(ST_Collect(p.geom), 0, ST_Expand(h.geom, 0.3)))).geom AS cell
                  FROM pts p CROSS JOIN hull h GROUP BY h.geom)
     SELECT p.kode, p.nama,
            ST_AsGeoJSON(ST_Multi(ST_CollectionExtract(ST_Intersection(v.cell, h.geom), 3))) AS geojson
     FROM vor v JOIN pts p ON ST_Covers(v.cell, p.geom) CROSS JOIN hull h`,
    [JSON.stringify(seeds)]
  );
  const fc = {
    type: 'FeatureCollection',
    features: r.rows.map((row) => ({
      type: 'Feature',
      properties: { kode_bps: row.kode, nama_wilayah: row.nama, level_wilayah: 'Kecamatan' },
      geometry: JSON.parse(row.geojson),
    })),
  };
  return dataset.importDataset(
    { kategori: 'wilayah', nama_dataset: 'DEMO Batas Kecamatan Kab. Bogor', sumber: SUMBER, tahun: TAHUN, data: fc, catatan: 'Poligon Voronoi sintetis' },
    null
  );
}

function buatKependudukan() {
  const rows = KECAMATAN.map((k, i) => {
    const penduduk = Math.round(k[3] * 1000 * between(0.95, 1.05));
    return { kode_bps: kode(i), tahun: TAHUN, jumlah_penduduk: penduduk, penduduk_usia_smp: Math.round(penduduk * 0.048 * between(0.95, 1.05)) };
  });
  return { rows };
}

async function titikSekolah(kependudukan) {
  // Sekolah mengelompok di sekitar pusat kecamatan -> pinggiran kecamatan menjadi blank spot
  const spec = KECAMATAN.map((k, i) => {
    const usia = kependudukan.rows[i].penduduk_usia_smp;
    const pasokan = { U: between(0.75, 1.1), D: between(0.55, 0.95), R: between(0.4, 0.8) }[k[4]];
    const n = Math.max(1, Math.round((usia * 0.9 * pasokan) / 330));
    return { kode: kode(i), n, radius: { U: 6000, D: 4000, R: 2500 }[k[4]], seed: 1000 + i, kepadatanKelas: between(0.85, 1.5), guruRatio: between(14, 28) };
  });
  const r = await db.query(
    `SELECT s.kode, ST_X(g.geom) AS lng, ST_Y(g.geom) AS lat
     FROM jsonb_to_recordset($1::jsonb) AS s(kode text, n int, radius float8, seed int)
     JOIN wilayah w ON w.kode_bps = s.kode
     CROSS JOIN LATERAL (
       SELECT (ST_Dump(ST_GeneratePoints(
                 ST_CollectionExtract(ST_Intersection(w.geom, ST_Buffer(ST_PointOnSurface(w.geom)::geography, s.radius)::geometry), 3),
                 s.n, s.seed))).geom AS geom
     ) g`,
    [JSON.stringify(spec)]
  );
  return { spec, titik: r.rows };
}

function buatSekolah(spec, titik) {
  const rows = [];
  const perKec = {};
  titik.forEach((t, idx) => {
    const s = spec.find((x) => x.kode === t.kode);
    const idxKec = KECAMATAN.findIndex((_, i) => kode(i) === t.kode);
    perKec[t.kode] = (perKec[t.kode] || 0) + 1;
    const nomor = perKec[t.kode];
    const negeri = rand() < 0.4;
    const siswa = Math.round(330 * between(0.5, 1.5));
    const rasioKelas = 32 * s.kepadatanKelas * between(0.92, 1.08);
    rows.push({
      npsn: `DEMO${String(idx + 1).padStart(5, '0')}`,
      nama_sekolah: negeri ? `SMPN ${nomor} ${KECAMATAN[idxKec][0]} (demo)` : `SMP Swasta ${nomor} ${KECAMATAN[idxKec][0]} (demo)`,
      status_sekolah: negeri ? 'Negeri' : 'Swasta',
      alamat: `Kec. ${KECAMATAN[idxKec][0]}, Kabupaten Bogor (alamat contoh)`,
      jenjang: 'SMP',
      akreditasi: ['A', 'A', 'B', 'B', 'C'][Math.floor(rand() * 5)],
      latitude: t.lat,
      longitude: t.lng,
      tahun: TAHUN,
      jumlah_siswa: siswa,
      jumlah_ruang_kelas: Math.max(3, Math.round(siswa / rasioKelas)),
      jumlah_rombel: Math.max(3, Math.ceil(siswa / 36)),
      jumlah_guru: Math.max(6, Math.round(siswa / s.guruRatio)),
      _kec: idxKec,
    });
  });
  return rows;
}

function buatJalan(sekolahRows) {
  const features = [];
  const pusat = KECAMATAN.map((k) => [k[1], k[2]]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const dibuat = new Set();
  pusat.forEach((p, i) => {
    pusat
      .map((q, j) => ({ j, d: dist(p, q) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach((x) => {
        const key = [Math.min(i, x.j), Math.max(i, x.j)].join('-');
        if (dibuat.has(key)) return;
        dibuat.add(key);
        features.push({ type: 'Feature', properties: { nama: 'Jalan penghubung (demo)', kelas_jalan: 'Kolektor' }, geometry: { type: 'LineString', coordinates: [p, pusat[x.j]] } });
      });
  });
  sekolahRows.forEach((s) => {
    features.push({ type: 'Feature', properties: { nama: 'Jalan lingkungan (demo)', kelas_jalan: 'Lokal' }, geometry: { type: 'LineString', coordinates: [pusat[s._kec], [s.longitude, s.latitude]] } });
  });
  return { type: 'FeatureCollection', features };
}

function buatConstraint() {
  const risiko = [];
  const lereng = [];
  KECAMATAN.forEach((k) => {
    const selatan = k[2] < -6.62; // lereng Gunung Salak/Gede-Pangrango di selatan
    const sedang = k[2] < -6.55;
    if (selatan || rand() < 0.25) {
      risiko.push({
        type: 'Feature',
        properties: { nama: `Rawan longsor ${k[0]} (demo)`, level: selatan ? (rand() < 0.5 ? 5 : 4) : 3 },
        geometry: circle(k[1] + between(-0.03, 0.03), k[2] + between(-0.02, 0.02), between(2, 4.5)),
      });
    }
    lereng.push({
      type: 'Feature',
      properties: { nama: `Kemiringan ${k[0]} (demo)`, nilai: Math.round((selatan ? between(18, 45) : sedang ? between(8, 22) : between(1, 9)) * 10) / 10 },
      geometry: circle(k[1] + between(-0.04, 0.04), k[2] + between(-0.03, 0.03), between(4, 8)),
    });
  });
  const lindung = [{ type: 'Feature', properties: { nama: 'Kawasan konservasi (demo)' }, geometry: circle(106.88, -6.72, 5) }];
  return {
    risiko: { type: 'FeatureCollection', features: risiko },
    lereng: { type: 'FeatureCollection', features: lereng },
    lindung: { type: 'FeatureCollection', features: lindung },
  };
}

(async () => {
  try {
    await seedRoles();
    await seedIndikator();
    await hapusDemoLama();

    const base = { sumber: SUMBER, tahun: TAHUN };
    const w = await buatWilayah();
    console.log(`✅ Wilayah: ${w.hasil.diproses} kecamatan`);

    const kep = buatKependudukan();
    const k = await dataset.importDataset({ ...base, kategori: 'kependudukan', nama_dataset: 'DEMO Kependudukan', data: kep.rows }, null);
    console.log(`✅ Kependudukan: ${k.hasil.diproses} baris`);

    const { spec, titik } = await titikSekolah(kep);
    const sekolahRows = buatSekolah(spec, titik);
    const s = await dataset.importDataset({ ...base, kategori: 'sekolah', nama_dataset: 'DEMO Sekolah SMP + statistik', data: sekolahRows }, null);
    console.log(`✅ Sekolah: ${s.hasil.diproses} sekolah, ${s.hasil.statistik} statistik`);

    const j = await dataset.importDataset({ ...base, kategori: 'jalan', nama_dataset: 'DEMO Jaringan Jalan', data: buatJalan(sekolahRows) }, null);
    console.log(`✅ Jalan: ${j.hasil.diproses} ruas`);

    const c = buatConstraint();
    await dataset.importDataset({ ...base, kategori: 'risiko_bencana', nama_dataset: 'DEMO Risiko Bencana', data: c.risiko }, null);
    await dataset.importDataset({ ...base, kategori: 'lereng', nama_dataset: 'DEMO Lereng', data: c.lereng }, null);
    await dataset.importDataset({ ...base, kategori: 'kawasan_lindung', nama_dataset: 'DEMO Kawasan Lindung', data: c.lindung }, null);
    console.log('✅ Layer constraint: risiko bencana, lereng, kawasan lindung');

    const a = await analysis.recalculate({ tahun: TAHUN });
    console.log(`✅ Analisis dihitung untuk ${a.jumlah_wilayah} kecamatan (tahun ${a.tahun}, radius ${a.radius_km} km)`);

    const cand = await candidates.generateCandidates({ tahun: TAHUN, top_wilayah: 5, top_n: 10 });
    console.log(`✅ Area kandidat: ${cand.kandidat_tersimpan} lokasi dari ${cand.sel_layak}/${cand.sel_dianalisis} sel layak`);
    console.log('\nSelesai. Jalankan `npm run seed:users` untuk membuat akun login, lalu `npm run dev`.');
  } catch (e) {
    console.error('❌ Seed demo gagal:', e.message);
    if (e.detail) console.error(e.detail);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
