const db = require('../config/db');
const { parseCSV } = require('../utils/csv');
const { httpError } = require('../middleware/errorHandler');

/**
 * Kategori dataset yang dapat diimpor Operator.
 *  - tabel: tabel tujuan (juga dipakai untuk penghapusan berdasarkan id_dataset)
 *  - format: 'geojson' = FeatureCollection, 'tabel' = CSV / array JSON, 'keduanya' = salah satunya
 *  - memengaruhiAnalisis: setelah impor, skor prioritas perlu dihitung ulang
 */
const KATEGORI = {
  wilayah: { label: 'Batas Wilayah', tabel: 'wilayah', format: 'geojson', memengaruhiAnalisis: true },
  sekolah: { label: 'Sebaran Sekolah', tabel: 'sekolah', format: 'keduanya', memengaruhiAnalisis: true },
  statistik: { label: 'Statistik Sekolah', tabel: 'statistik_pendidikan', format: 'tabel', memengaruhiAnalisis: true },
  kependudukan: { label: 'Kependudukan', tabel: 'kependudukan', format: 'tabel', memengaruhiAnalisis: true },
  jalan: { label: 'Jaringan Jalan', tabel: 'jalan', format: 'geojson', memengaruhiAnalisis: false },
  risiko_bencana: { label: 'Risiko Bencana', tabel: 'layer_constraint', format: 'geojson', memengaruhiAnalisis: false },
  lereng: { label: 'Lereng / Topografi', tabel: 'layer_constraint', format: 'geojson', memengaruhiAnalisis: false },
  kawasan_lindung: { label: 'Kawasan Lindung', tabel: 'layer_constraint', format: 'geojson', memengaruhiAnalisis: false },
};

const TABEL_DENGAN_DATASET = ['wilayah', 'sekolah', 'statistik_pendidikan', 'kependudukan', 'jalan', 'layer_constraint'];

// ---------------------------------------------------------------------------
// Pembantu parsing
// ---------------------------------------------------------------------------

/** Ambil nilai properti dengan beberapa kemungkinan nama (tidak peka huruf besar/kecil) */
function pick(props, aliases) {
  if (!props) return undefined;
  const lower = {};
  Object.keys(props).forEach((k) => {
    lower[k.toLowerCase()] = props[k];
  });
  for (const a of aliases) {
    const v = lower[a.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/** Angka bulat/umum. Mengenali format Indonesia ("1.250" = seribu dua ratus lima puluh, "3,5" = 3,5) */
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim();
  const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};
// Angka desimal (koordinat/lereng) tidak boleh dibuang titiknya
const dec = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const slug = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Kode cadangan bila berkas tidak memuat kode wilayah. Kolom kode_bps maksimum 20 karakter. */
const autoKode = (level, nama) => `AUTO-${slug(level).charAt(0)}-${slug(nama).slice(0, 12)}`;

function toFeatures(data) {
  if (!data) throw httpError(400, 'Isi dataset (data) kosong.');
  let obj = data;
  if (typeof data === 'string') {
    try {
      obj = JSON.parse(data);
    } catch (e) {
      throw httpError(400, 'Berkas bukan GeoJSON yang valid.');
    }
  }
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) return obj.features;
  if (obj.type === 'Feature') return [obj];
  throw httpError(400, 'GeoJSON harus berupa FeatureCollection.');
}

function toRows(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') return parseCSV(data);
  throw httpError(400, 'Data tabel harus berupa teks CSV atau array JSON.');
}

/** Dari FeatureCollection Point atau baris CSV (lat/lng) menjadi daftar {props, lng, lat} */
function toPointRecords(data) {
  if (typeof data === 'string' && !data.trim().startsWith('{')) {
    return parseCSV(data).map((row) => ({
      props: row,
      lat: dec(pick(row, ['latitude', 'lat', 'y'])),
      lng: dec(pick(row, ['longitude', 'lng', 'lon', 'long', 'x'])),
    }));
  }
  if (Array.isArray(data)) {
    return data.map((row) => ({
      props: row,
      lat: dec(pick(row, ['latitude', 'lat', 'y'])),
      lng: dec(pick(row, ['longitude', 'lng', 'lon', 'long', 'x'])),
    }));
  }
  return toFeatures(data).map((f) => {
    const g = f.geometry;
    let lng = null;
    let lat = null;
    if (g && g.type === 'Point') [lng, lat] = g.coordinates;
    else if (g && g.type === 'MultiPoint' && g.coordinates.length) [lng, lat] = g.coordinates[0];
    return { props: f.properties || {}, lng: dec(lng), lat: dec(lat) };
  });
}

const STAT_ALIASES = {
  jumlah_siswa: ['jumlah_siswa', 'siswa', 'peserta_didik'],
  jumlah_guru: ['jumlah_guru', 'guru', 'tenaga_pendidik'],
  jumlah_rombel: ['jumlah_rombel', 'rombel'],
  jumlah_ruang_kelas: ['jumlah_ruang_kelas', 'ruang_kelas', 'ruang_kelas_total', 'kelas'],
};

// ---------------------------------------------------------------------------
// Impor per kategori (dijalankan dalam transaksi)
// ---------------------------------------------------------------------------

const geomFromGeoJSON = (param, sridParam) =>
  `ST_Force2D(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${param}), ${sridParam}::int), 4326))`;

async function importWilayah(client, ctx) {
  const features = toFeatures(ctx.data);
  const out = { diproses: 0, ditambah: 0, diperbarui: 0, dilewati: 0, galat: [] };
  const defaultLevel = ctx.opsi.level_wilayah || 'Kecamatan';

  for (let i = 0; i < features.length; i += 1) {
    const f = features[i];
    const p = f.properties || {};
    const nama = pick(p, ['nama_wilayah', 'nama', 'namobj', 'wadmkc', 'kecamatan', 'nm_kecamatan', 'nama_kec']);
    if (!f.geometry || !nama) {
      out.dilewati += 1;
      out.galat.push(`Fitur #${i + 1}: geometri atau nama wilayah tidak ada.`);
      continue;
    }
    const level = pick(p, ['level_wilayah', 'level', 'tingkat']) || defaultLevel;
    const kode =
      pick(p, ['kode_bps', 'kode', 'kdkec', 'kode_kec', 'kdcbps', 'kdcpum', 'adm3_pcode', 'kode_wilayah']) ||
      autoKode(level, nama);
    const parentKode = pick(p, ['parent_kode', 'kode_parent', 'kode_induk']);
    const luas = dec(pick(p, ['luas_km2', 'luas']));

    try {
      await client.query('SAVEPOINT feat');
      const r = await client.query(
        `INSERT INTO wilayah (kode_bps, parent_id, nama_wilayah, level_wilayah, luas_km2, geom, id_dataset)
         VALUES ($1, (SELECT id_wilayah FROM wilayah WHERE kode_bps = $2), $3, $4, $5,
                 ST_Multi(ST_CollectionExtract(ST_MakeValid(${geomFromGeoJSON('$6::text', '$7')}), 3)), $8)
         ON CONFLICT (kode_bps) DO UPDATE
           SET nama_wilayah = EXCLUDED.nama_wilayah, level_wilayah = EXCLUDED.level_wilayah,
               luas_km2 = COALESCE(EXCLUDED.luas_km2, wilayah.luas_km2),
               parent_id = COALESCE(EXCLUDED.parent_id, wilayah.parent_id),
               geom = EXCLUDED.geom, id_dataset = EXCLUDED.id_dataset
         RETURNING (xmax = 0) AS inserted`,
        [String(kode), parentKode ? String(parentKode) : null, String(nama), String(level), luas, JSON.stringify(f.geometry), ctx.crs, ctx.idDataset]
      );
      await client.query('RELEASE SAVEPOINT feat');
      out.diproses += 1;
      if (r.rows[0].inserted) out.ditambah += 1;
      else out.diperbarui += 1;
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT feat');
      out.dilewati += 1;
      out.galat.push(`Fitur #${i + 1} (${nama}): ${e.message}`);
    }
  }

  await client.query(
    `UPDATE wilayah SET luas_km2 = ST_Area(geom::geography) / 1000000.0
     WHERE id_dataset = $1 AND luas_km2 IS NULL AND geom IS NOT NULL`,
    [ctx.idDataset]
  );
  // Sekolah yang diunggah sebelum batas wilayah ada: tetapkan kecamatannya sekarang
  await client.query(
    `UPDATE sekolah s SET id_wilayah = w.id_wilayah
     FROM wilayah w
     WHERE s.id_wilayah IS NULL AND w.level_wilayah = 'Kecamatan' AND w.geom IS NOT NULL AND s.geom IS NOT NULL
       AND ST_Covers(w.geom, s.geom)`
  );
  return out;
}

async function upsertStatistik(client, idSekolah, tahun, row, idDataset) {
  const vals = {};
  let ada = false;
  Object.entries(STAT_ALIASES).forEach(([k, aliases]) => {
    const v = num(pick(row, aliases));
    vals[k] = v;
    if (v !== null) ada = true;
  });
  if (!ada) return false;
  await client.query(
    `INSERT INTO statistik_pendidikan (id_sekolah, tahun, jumlah_siswa, jumlah_guru, jumlah_rombel, jumlah_ruang_kelas, id_dataset)
     VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 0), $7)
     ON CONFLICT (id_sekolah, tahun) DO UPDATE
       SET jumlah_siswa = COALESCE($3, statistik_pendidikan.jumlah_siswa),
           jumlah_guru = COALESCE($4, statistik_pendidikan.jumlah_guru),
           jumlah_rombel = COALESCE($5, statistik_pendidikan.jumlah_rombel),
           jumlah_ruang_kelas = COALESCE($6, statistik_pendidikan.jumlah_ruang_kelas),
           id_dataset = $7`,
    [idSekolah, tahun, vals.jumlah_siswa, vals.jumlah_guru, vals.jumlah_rombel, vals.jumlah_ruang_kelas, idDataset]
  );
  return true;
}

async function importSekolah(client, ctx) {
  const records = toPointRecords(ctx.data);
  const out = { diproses: 0, ditambah: 0, diperbarui: 0, dilewati: 0, statistik: 0, galat: [] };
  const tahunDefault = parseInt(ctx.tahun, 10) || new Date().getFullYear();

  for (let i = 0; i < records.length; i += 1) {
    const { props, lng, lat } = records[i];
    const nama = pick(props, ['nama_sekolah', 'nama', 'namobj', 'nm_sekolah']);
    const npsn = pick(props, ['npsn', 'kode_sekolah']);
    if (!nama || !npsn || lng === null || lat === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      out.dilewati += 1;
      out.galat.push(`Baris #${i + 1}: butuh npsn, nama, dan koordinat (latitude/longitude) yang valid.`);
      continue;
    }
    try {
      await client.query('SAVEPOINT rec');
      const status = pick(props, ['status_sekolah', 'status']) || 'Negeri';
      const r = await client.query(
        `INSERT INTO sekolah (npsn, nama_sekolah, status_sekolah, alamat, jenjang, akreditasi, geom, id_dataset)
         VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9)
         ON CONFLICT (npsn) DO UPDATE
           SET nama_sekolah = EXCLUDED.nama_sekolah, status_sekolah = EXCLUDED.status_sekolah,
               alamat = COALESCE(EXCLUDED.alamat, sekolah.alamat), jenjang = EXCLUDED.jenjang,
               akreditasi = COALESCE(EXCLUDED.akreditasi, sekolah.akreditasi),
               geom = EXCLUDED.geom, id_dataset = EXCLUDED.id_dataset
         RETURNING id_sekolah, (xmax = 0) AS inserted`,
        [
          String(npsn), String(nama), String(status),
          pick(props, ['alamat', 'alamat_jalan']) ? String(pick(props, ['alamat', 'alamat_jalan'])) : null,
          String(pick(props, ['jenjang', 'bentuk_pendidikan']) || 'SMP'),
          pick(props, ['akreditasi']) ? String(pick(props, ['akreditasi'])).slice(0, 5) : null,
          lng, lat, ctx.idDataset,
        ]
      );
      const { id_sekolah: idSekolah, inserted } = r.rows[0];
      const tahun = parseInt(pick(props, ['tahun']), 10) || tahunDefault;
      if (await upsertStatistik(client, idSekolah, tahun, props, ctx.idDataset)) out.statistik += 1;
      await client.query('RELEASE SAVEPOINT rec');
      out.diproses += 1;
      if (inserted) out.ditambah += 1;
      else out.diperbarui += 1;
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT rec');
      out.dilewati += 1;
      out.galat.push(`Baris #${i + 1} (${nama}): ${e.message}`);
    }
  }

  // Tetapkan kecamatan tiap sekolah lewat spatial join (titik berada di dalam poligon)
  await client.query(
    `UPDATE sekolah s SET id_wilayah = w.id_wilayah
     FROM wilayah w
     WHERE s.id_dataset = $1 AND w.level_wilayah = 'Kecamatan' AND w.geom IS NOT NULL AND ST_Covers(w.geom, s.geom)`,
    [ctx.idDataset]
  );
  const unmatched = await client.query(`SELECT COUNT(*)::int AS n FROM sekolah WHERE id_dataset = $1 AND id_wilayah IS NULL`, [ctx.idDataset]);
  if (unmatched.rows[0].n > 0) {
    out.galat.push(`${unmatched.rows[0].n} sekolah berada di luar semua poligon kecamatan yang ada (tidak masuk perhitungan wilayah).`);
  }
  return out;
}

async function importStatistik(client, ctx) {
  const rows = toRows(ctx.data);
  const out = { diproses: 0, ditambah: 0, diperbarui: 0, dilewati: 0, galat: [] };
  const tahunDefault = parseInt(ctx.tahun, 10) || new Date().getFullYear();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const npsn = pick(row, ['npsn', 'kode_sekolah']);
    const found = npsn ? await client.query('SELECT id_sekolah FROM sekolah WHERE npsn = $1', [String(npsn)]) : { rows: [] };
    if (found.rows.length === 0) {
      out.dilewati += 1;
      out.galat.push(`Baris #${i + 1}: NPSN ${npsn || '(kosong)'} tidak ditemukan di data sekolah.`);
      continue;
    }
    const tahun = parseInt(pick(row, ['tahun']), 10) || tahunDefault;
    if (await upsertStatistik(client, found.rows[0].id_sekolah, tahun, row, ctx.idDataset)) {
      out.diproses += 1;
      out.diperbarui += 1;
    } else {
      out.dilewati += 1;
      out.galat.push(`Baris #${i + 1}: tidak ada kolom statistik (jumlah_siswa, jumlah_guru, jumlah_rombel, jumlah_ruang_kelas).`);
    }
  }
  return out;
}

async function importKependudukan(client, ctx) {
  const rows = toRows(ctx.data);
  const out = { diproses: 0, ditambah: 0, diperbarui: 0, dilewati: 0, galat: [] };
  const tahunDefault = parseInt(ctx.tahun, 10) || new Date().getFullYear();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const kode = pick(row, ['kode_bps', 'kode', 'kdkec', 'kode_kec', 'kode_wilayah']);
    const w = kode ? await client.query('SELECT id_wilayah, luas_km2 FROM wilayah WHERE kode_bps = $1', [String(kode)]) : { rows: [] };
    if (w.rows.length === 0) {
      out.dilewati += 1;
      out.galat.push(`Baris #${i + 1}: kode wilayah ${kode || '(kosong)'} tidak ditemukan.`);
      continue;
    }
    const penduduk = num(pick(row, ['jumlah_penduduk', 'penduduk']));
    const usia = num(pick(row, ['penduduk_usia_smp', 'usia_smp', 'usia_13_15']));
    if (penduduk === null && usia === null) {
      out.dilewati += 1;
      out.galat.push(`Baris #${i + 1}: butuh jumlah_penduduk dan/atau penduduk_usia_smp.`);
      continue;
    }
    const luas = w.rows[0].luas_km2;
    const kepadatan = dec(pick(row, ['kepadatan'])) ?? (luas && penduduk ? penduduk / luas : null);
    const tahun = parseInt(pick(row, ['tahun']), 10) || tahunDefault;
    const r = await client.query(
      `INSERT INTO kependudukan (id_wilayah, tahun, jumlah_penduduk, penduduk_usia_smp, kepadatan, id_dataset)
       VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), $5, $6)
       ON CONFLICT (id_wilayah, tahun) DO UPDATE
         SET jumlah_penduduk = COALESCE($3, kependudukan.jumlah_penduduk),
             penduduk_usia_smp = COALESCE($4, kependudukan.penduduk_usia_smp),
             kepadatan = COALESCE($5, kependudukan.kepadatan), id_dataset = $6
       RETURNING (xmax = 0) AS inserted`,
      [w.rows[0].id_wilayah, tahun, penduduk, usia, kepadatan, ctx.idDataset]
    );
    out.diproses += 1;
    if (r.rows[0].inserted) out.ditambah += 1;
    else out.diperbarui += 1;
  }
  return out;
}

/** Impor set-based per potongan untuk layer besar (jalan, constraint) */
async function importGeometriLayer(client, ctx, { kategori }) {
  const features = toFeatures(ctx.data);
  const out = { diproses: 0, ditambah: 0, diperbarui: 0, dilewati: 0, galat: [] };
  const CHUNK = 500;

  const records = features
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => {
      if (!f.geometry) {
        out.dilewati += 1;
        out.galat.push(`Fitur #${i + 1}: geometri kosong.`);
        return false;
      }
      return true;
    });

  for (let s = 0; s < records.length; s += CHUNK) {
    const slice = records.slice(s, s + CHUNK).map(({ f }) => {
      const p = f.properties || {};
      if (kategori === 'jalan') {
        return {
          nama: pick(p, ['nama', 'namobj', 'remark', 'name']) || null,
          kelas: pick(p, ['kelas_jalan', 'kelas', 'fungsi', 'klasifikasi', 'rute', 'fclass']) || null,
          level: null,
          nilai: null,
          geometry: f.geometry,
        };
      }
      const level = pick(p, ['level', 'kelas_risiko', 'tingkat_risiko', 'bahaya', 'kerawanan']);
      let lv = num(level);
      if (lv !== null) lv = Math.round(lv);
      if (lv === null && typeof level === 'string') {
        const map = { rendah: 1, sedang: 3, tinggi: 4, 'sangat tinggi': 5 };
        lv = map[level.toLowerCase()] ?? null;
      }
      return {
        nama: pick(p, ['nama', 'namobj', 'remark', 'jenis_bencana']) || null,
        kelas: null,
        level: lv,
        nilai: dec(pick(p, ['nilai', 'lereng_pct', 'slope', 'kemiringan', 'lereng'])),
        geometry: f.geometry,
      };
    });

    const payload = JSON.stringify(slice);
    let result;
    if (kategori === 'jalan') {
      result = await client.query(
        `INSERT INTO jalan (nama, kelas_jalan, geom, id_dataset)
         SELECT x.nama, x.kelas, d.geom, $2::bigint
         FROM jsonb_to_recordset($1::jsonb) AS x(nama text, kelas text, geometry jsonb)
         CROSS JOIN LATERAL (
           SELECT (ST_Dump(${geomFromGeoJSON('x.geometry::text', '$3')})).geom AS geom
         ) d
         WHERE GeometryType(d.geom) = 'LINESTRING'`,
        [payload, ctx.idDataset, ctx.crs]
      );
    } else {
      result = await client.query(
        `INSERT INTO layer_constraint (jenis, nama, level, nilai, geom, id_dataset)
         SELECT $4::text, x.nama, x.level, x.nilai,
                ST_Multi(ST_CollectionExtract(ST_MakeValid(${geomFromGeoJSON('x.geometry::text', '$3')}), 3)), $2::bigint
         FROM jsonb_to_recordset($1::jsonb) AS x(nama text, level int, nilai numeric, geometry jsonb)`,
        [payload, ctx.idDataset, ctx.crs, kategori]
      );
    }
    out.diproses += slice.length;
    out.ditambah += result.rowCount;
  }
  return out;
}

const IMPORTERS = {
  wilayah: importWilayah,
  sekolah: importSekolah,
  statistik: importStatistik,
  kependudukan: importKependudukan,
  jalan: (c, x) => importGeometriLayer(c, x, { kategori: 'jalan' }),
  risiko_bencana: (c, x) => importGeometriLayer(c, x, { kategori: 'risiko_bencana' }),
  lereng: (c, x) => importGeometriLayer(c, x, { kategori: 'lereng' }),
  kawasan_lindung: (c, x) => importGeometriLayer(c, x, { kategori: 'kawasan_lindung' }),
};

// ---------------------------------------------------------------------------
// API layanan
// ---------------------------------------------------------------------------

/**
 * Impor dataset. body: { kategori, nama_dataset, sumber, tahun, format, crs, data, level_wilayah?, catatan? }
 * Seluruh proses (metadata + data) berjalan dalam satu transaksi: gagal = tidak ada yang tersimpan.
 */
async function importDataset(body, userId) {
  const { kategori, nama_dataset: nama, sumber, tahun, format, crs, data, catatan } = body || {};
  const def = KATEGORI[kategori];
  if (!def) throw httpError(400, `Kategori tidak dikenal. Pilihan: ${Object.keys(KATEGORI).join(', ')}.`);
  if (!nama || !String(nama).trim()) throw httpError(400, 'nama_dataset wajib diisi.');
  if (data === undefined || data === null || data === '') throw httpError(400, 'Isi dataset (data) kosong.');
  const srid = parseInt(crs, 10) || 4326;
  if (!Number.isFinite(srid) || srid < 1 || srid > 999999) throw httpError(400, 'crs harus berupa kode EPSG angka.');

  return db.withTransaction(async (client) => {
    const meta = await client.query(
      `INSERT INTO dataset_metadata
         (uploaded_by, nama_dataset, kategori, sumber, tahun, format, crs, status_validasi, target_tabel, aktif, catatan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Valid', $8, TRUE, $9)
       RETURNING id_dataset`,
      [userId || null, String(nama).trim(), kategori, sumber || 'Unggahan Operator', parseInt(tahun, 10) || null,
        String(format || (typeof data === 'string' && !String(data).trim().startsWith('{') ? 'CSV' : 'GeoJSON')).slice(0, 20),
        `EPSG:${srid}`, def.tabel, catatan || null]
    );
    const idDataset = meta.rows[0].id_dataset;
    const ctx = { data, idDataset, crs: srid, tahun, opsi: body };
    const hasil = await IMPORTERS[kategori](client, ctx);

    if (hasil.diproses === 0) {
      const err = httpError(400, 'Tidak ada data valid yang dapat diimpor.');
      err.detail = hasil.galat.slice(0, 20);
      throw err;
    }
    await client.query('UPDATE dataset_metadata SET jumlah_fitur = $2 WHERE id_dataset = $1', [idDataset, hasil.diproses]);
    return { id_dataset: idDataset, kategori, memengaruhi_analisis: def.memengaruhiAnalisis, hasil: { ...hasil, galat: hasil.galat.slice(0, 50) } };
  });
}

async function listDatasets() {
  const r = await db.query(
    `SELECT d.id_dataset, d.nama_dataset, d.kategori, d.sumber, d.tahun, d.format, d.crs, d.status_validasi,
            d.target_tabel, d.jumlah_fitur, d.aktif, d.catatan, d.created_at, u.nama AS diunggah_oleh
     FROM dataset_metadata d LEFT JOIN user_account u ON u.id_user = d.uploaded_by
     ORDER BY d.created_at DESC`
  );
  return r.rows.map((row) => ({ ...row, label_kategori: (KATEGORI[row.kategori] || {}).label || row.kategori }));
}

async function setDatasetAktif(id, aktif) {
  const r = await db.query('UPDATE dataset_metadata SET aktif = $2 WHERE id_dataset = $1 RETURNING *', [id, Boolean(aktif)]);
  if (r.rows.length === 0) throw httpError(404, 'Dataset tidak ditemukan.');
  return r.rows[0];
}

/** Menghapus dataset beserta seluruh baris yang berasal darinya */
async function deleteDataset(id) {
  return db.withTransaction(async (client) => {
    const meta = await client.query('SELECT id_dataset, target_tabel FROM dataset_metadata WHERE id_dataset = $1', [id]);
    if (meta.rows.length === 0) throw httpError(404, 'Dataset tidak ditemukan.');
    const tabel = meta.rows[0].target_tabel;
    let terhapus = 0;
    if (TABEL_DENGAN_DATASET.includes(tabel)) {
      // nama tabel berasal dari whitelist di atas, bukan input pengguna
      const del = await client.query(`DELETE FROM ${tabel} WHERE id_dataset = $1`, [id]);
      terhapus = del.rowCount;
    }
    await client.query('DELETE FROM dataset_metadata WHERE id_dataset = $1', [id]);
    return { id_dataset: id, baris_terhapus: terhapus };
  });
}

/** Jumlah baris per tabel data aktif (untuk panel kesiapan data di dashboard operator) */
async function dataStatus() {
  const r = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM wilayah WHERE level_wilayah = 'Kecamatan')::int AS kecamatan,
       (SELECT COUNT(*) FROM sekolah)::int AS sekolah,
       (SELECT COUNT(*) FROM statistik_pendidikan)::int AS statistik,
       (SELECT COUNT(*) FROM kependudukan)::int AS kependudukan,
       (SELECT COUNT(*) FROM jalan)::int AS jalan,
       (SELECT COUNT(*) FROM layer_constraint WHERE jenis = 'risiko_bencana')::int AS risiko_bencana,
       (SELECT COUNT(*) FROM layer_constraint WHERE jenis = 'lereng')::int AS lereng,
       (SELECT COUNT(*) FROM layer_constraint WHERE jenis = 'kawasan_lindung')::int AS kawasan_lindung,
       (SELECT COUNT(*) FROM priority_score)::int AS skor_prioritas,
       (SELECT MAX(tahun) FROM priority_score) AS tahun_skor`
  );
  return r.rows[0];
}

module.exports = {
  KATEGORI, importDataset, listDatasets, setDatasetAktif, deleteDataset, dataStatus,
  _internal: { pick, num, dec, toPointRecords, toFeatures, toRows, autoKode },
};
