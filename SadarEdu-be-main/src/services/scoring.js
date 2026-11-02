/**
 * Logika inti analisis SADAR Edu (fungsi murni, tanpa akses database).
 *
 * Alur: metrik mentah per kecamatan -> indikator turunan -> normalisasi min-max
 * (0 = kebutuhan terendah, 1 = tertinggi) -> pembobotan (MCDA / weighted sum)
 * -> skor 0-100 -> kategori, diagnosis, dan rekomendasi intervensi.
 */
const defaultConfig = require('../config/analysis');

// Katalog indikator bawaan. Bobot total = 1.0. Dapat diubah Stakeholder lewat API.
const INDIKATOR_DEFAULT = [
  {
    kode_indikator: 'GAP_KAPASITAS',
    nama_indikator: 'Kekurangan Kapasitas Ruang Kelas',
    satuan: '%',
    arah_pengaruh: 'Positif',
    bobot: 0.2,
    kelompok: 'Beban Layanan',
    deskripsi: 'Persentase estimasi penduduk usia SMP yang tidak tertampung kapasitas ruang kelas yang ada.',
  },
  {
    kode_indikator: 'RASIO_SISWA_KELAS',
    nama_indikator: 'Siswa per Ruang Kelas',
    satuan: 'siswa/kelas',
    arah_pengaruh: 'Positif',
    bobot: 0.15,
    kelompok: 'Beban Layanan',
    deskripsi: 'Rata-rata jumlah siswa untuk setiap ruang kelas. Semakin tinggi, semakin padat.',
  },
  {
    kode_indikator: 'BEBAN_SISWA_SEKOLAH',
    nama_indikator: 'Siswa per Sekolah',
    satuan: 'siswa/sekolah',
    arah_pengaruh: 'Positif',
    bobot: 0.1,
    kelompok: 'Beban Layanan',
    deskripsi: 'Rata-rata jumlah siswa yang dilayani satu sekolah di wilayah tersebut.',
  },
  {
    kode_indikator: 'RASIO_SISWA_GURU',
    nama_indikator: 'Siswa per Guru',
    satuan: 'siswa/guru',
    arah_pengaruh: 'Positif',
    bobot: 0.1,
    kelompok: 'Ketersediaan Guru',
    deskripsi: 'Rata-rata jumlah siswa untuk setiap guru. Semakin tinggi, semakin kekurangan guru.',
  },
  {
    kode_indikator: 'KEPADATAN_USIA_SMP',
    nama_indikator: 'Kepadatan Penduduk Usia SMP',
    satuan: 'jiwa/km2',
    arah_pengaruh: 'Positif',
    bobot: 0.15,
    kelompok: 'Kependudukan',
    deskripsi: 'Jumlah penduduk usia SMP (13-15 tahun) per kilometer persegi.',
  },
  {
    kode_indikator: 'AKSES_BLANK_SPOT',
    nama_indikator: 'Luas Area di Luar Jangkauan Sekolah',
    satuan: '%',
    arah_pengaruh: 'Positif',
    bobot: 0.2,
    kelompok: 'Aksesibilitas',
    deskripsi: 'Persentase luas wilayah yang berada di luar radius jangkauan sekolah terdekat (blank spot).',
  },
  {
    kode_indikator: 'JARAK_SEKOLAH',
    nama_indikator: 'Jarak ke Sekolah Terdekat',
    satuan: 'km',
    arah_pengaruh: 'Positif',
    bobot: 0.1,
    kelompok: 'Aksesibilitas',
    deskripsi: 'Jarak dari titik representatif wilayah ke sekolah SMP terdekat.',
  },
];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (v, d = 2) => (isNum(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const fmt = (v, d = 0) =>
  isNum(v) ? v.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '-';

// ---------------------------------------------------------------------------
// Metrik & indikator turunan
// ---------------------------------------------------------------------------

/**
 * Komponen metrik dengan memperhatikan KELENGKAPAN DATA.
 * Data sekolah nyata sering kosong (mis. ruang kelas tidak diisi). Nilai kosong BUKAN nol:
 *  - rasio siswa/kelas hanya memakai siswa dari sekolah yang ruang kelasnya tercatat,
 *  - rasio siswa/guru hanya memakai siswa dari sekolah yang gurunya tercatat,
 *  - sekolah tanpa data ruang kelas dianggap berkapasitas setara jumlah siswanya (netral).
 * Bila field turunan tidak ada (metrik lama), semua sekolah dianggap lengkap.
 */
function parts(m) {
  const siswa = toNum(m.jumlah_siswa) || 0;
  const sekolah = toNum(m.jumlah_sekolah) || 0;
  const pick = (v, fallback) => (v === undefined || v === null ? fallback : toNum(v) || 0);
  return {
    sekolah,
    sekolahAdaSiswa: pick(m.sekolah_ada_siswa, sekolah),
    siswa,
    siswaKelas: pick(m.siswa_dgn_kelas, siswa),
    siswaGuru: pick(m.siswa_dgn_guru, siswa),
    siswaTanpaKelas: pick(m.siswa_tanpa_data_kelas, 0),
    ruang: toNum(m.jumlah_ruang_kelas) || 0,
    guru: toNum(m.jumlah_guru) || 0,
  };
}

/** Estimasi jumlah siswa yang ingin ditampung = penduduk usia SMP x target APK */
const demandOf = (m, cfg = defaultConfig) => (toNum(m.penduduk_usia_smp) || 0) * cfg.TARGET_APK;
/** Kapasitas = ruang kelas tercatat x siswa per rombel + siswa di sekolah tanpa data kelas (netral) */
const kapasitasOf = (m, cfg = defaultConfig) => {
  const c = parts(m);
  return c.ruang * cfg.SISWA_PER_ROMBEL + c.siswaTanpaKelas;
};
const gapKursiOf = (m, cfg = defaultConfig) => Math.max(0, demandOf(m, cfg) - kapasitasOf(m, cfg));

/**
 * Menghitung nilai mentah tiap indikator dari metrik wilayah.
 * Mengembalikan null bila data pendukung tidak tersedia (indikator itu dilewati,
 * bobot dinormalkan ulang di antara indikator yang tersedia).
 */
function deriveIndicators(m, cfg = defaultConfig) {
  const c = parts(m);
  const usia = toNum(m.penduduk_usia_smp) || 0;
  const luas = toNum(m.luas_km2) || 0;
  const demand = demandOf(m, cfg);

  return {
    GAP_KAPASITAS: demand > 0 ? (gapKursiOf(m, cfg) / demand) * 100 : null,
    RASIO_SISWA_KELAS: c.ruang > 0 ? c.siswaKelas / c.ruang : null,
    // Wilayah tanpa sekolah diperlakukan seolah seluruh kebutuhan dilayani satu sekolah (kasus terburuk)
    BEBAN_SISWA_SEKOLAH: c.sekolah === 0 ? (demand > 0 ? demand : null) : c.sekolahAdaSiswa > 0 ? c.siswa / c.sekolahAdaSiswa : null,
    RASIO_SISWA_GURU: c.guru > 0 ? c.siswaGuru / c.guru : null,
    KEPADATAN_USIA_SMP: luas > 0 && usia > 0 ? usia / luas : null,
    AKSES_BLANK_SPOT: toNum(m.blank_pct),
    JARAK_SEKOLAH: toNum(m.jarak_terdekat_km),
  };
}

// ---------------------------------------------------------------------------
// Normalisasi & pembobotan
// ---------------------------------------------------------------------------

function columnStats(values) {
  const nums = values.filter(isNum);
  if (nums.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Normalisasi satu nilai ke 0..1 (1 = kebutuhan tertinggi) dengan memperhitungkan arah pengaruh */
function normalizeValue(value, stat, arah = 'Positif') {
  if (!isNum(value)) return null;
  const range = stat.max - stat.min;
  const n = range === 0 ? 0 : (value - stat.min) / range;
  const clamped = Math.min(1, Math.max(0, n));
  return arah === 'Negatif' ? 1 - clamped : clamped;
}

function categorize(skor, cfg = defaultConfig) {
  if (!isNum(skor)) return null;
  const hit = cfg.KATEGORI.find((k) => skor >= k.min);
  return hit ? hit.label : cfg.KATEGORI[cfg.KATEGORI.length - 1].label;
}

/** Skor 0-100 dari nilai ternormalisasi dengan bobot; bobot dinormalkan di antara indikator yang tersedia */
function weightedScore(norm, indikator, weightOverride) {
  let sumW = 0;
  let acc = 0;
  const kontribusi = {};
  indikator.forEach((ind) => {
    const w = weightOverride && weightOverride[ind.kode_indikator] !== undefined
      ? Number(weightOverride[ind.kode_indikator])
      : Number(ind.bobot);
    const n = norm[ind.kode_indikator];
    if (isNum(n) && Number.isFinite(w) && w > 0) {
      sumW += w;
      acc += w * n;
    }
  });
  indikator.forEach((ind) => {
    const w = weightOverride && weightOverride[ind.kode_indikator] !== undefined
      ? Number(weightOverride[ind.kode_indikator])
      : Number(ind.bobot);
    const n = norm[ind.kode_indikator];
    kontribusi[ind.kode_indikator] = isNum(n) && sumW > 0 && w > 0 ? ((w * n) / sumW) * 100 : 0;
  });
  return { skor: sumW > 0 ? (acc / sumW) * 100 : null, kontribusi };
}

/**
 * Menghitung skor semua wilayah.
 * @param rows [{ id, metrics?, raw? }]  raw (nilai indikator mentah) opsional; bila kosong diturunkan dari metrics
 * @param indikator daftar indikator {kode_indikator, bobot, arah_pengaruh, ...}
 */
function computeScores(rows, indikator, { cfg = defaultConfig, weights } = {}) {
  const prepared = rows.map((r) => ({ ...r, raw: r.raw || deriveIndicators(r.metrics || {}, cfg) }));

  const stats = {};
  indikator.forEach((ind) => {
    stats[ind.kode_indikator] = columnStats(prepared.map((r) => r.raw[ind.kode_indikator]));
  });

  const results = prepared.map((r) => {
    const norm = {};
    indikator.forEach((ind) => {
      norm[ind.kode_indikator] = normalizeValue(r.raw[ind.kode_indikator], stats[ind.kode_indikator], ind.arah_pengaruh);
    });
    const { skor, kontribusi } = weightedScore(norm, indikator, weights);
    return {
      id: r.id,
      metrics: r.metrics,
      raw: r.raw,
      norm,
      kontribusi,
      skor: isNum(skor) ? round(skor, 2) : null,
      kategori: categorize(skor, cfg),
    };
  });

  // Ranking: skor tertinggi = prioritas 1 (kompetisi standar: skor sama -> ranking sama)
  const sorted = [...results].filter((r) => isNum(r.skor)).sort((a, b) => b.skor - a.skor);
  sorted.forEach((r, i) => {
    r.ranking = i > 0 && sorted[i - 1].skor === r.skor ? sorted[i - 1].ranking : i + 1;
  });
  results.forEach((r) => {
    if (!isNum(r.ranking)) r.ranking = null;
  });

  return { results, stats };
}

// ---------------------------------------------------------------------------
// Diagnosis & rekomendasi intervensi
// ---------------------------------------------------------------------------

function diagnose({ nama, metrics, kontribusi, indikator, cfg = defaultConfig }) {
  const m = metrics || {};
  const raw = deriveIndicators(m, cfg);
  const masalah = [];
  const kalimat = [];

  const sekolah = toNum(m.jumlah_sekolah) || 0;
  const demand = demandOf(m, cfg);
  const gap = gapKursiOf(m, cfg);

  if (sekolah === 0) {
    masalah.push('TANPA_SEKOLAH');
    kalimat.push('Belum ada sekolah SMP yang tercatat di wilayah ini.');
  }
  if (isNum(raw.RASIO_SISWA_KELAS) && raw.RASIO_SISWA_KELAS > cfg.SISWA_PER_ROMBEL) {
    masalah.push('KELAS_PADAT');
    kalimat.push(
      `Rata-rata ${fmt(raw.RASIO_SISWA_KELAS, 1)} siswa per ruang kelas, melampaui acuan ${fmt(cfg.SISWA_PER_ROMBEL)} siswa per rombel.`
    );
  }
  if (isNum(raw.RASIO_SISWA_GURU) && raw.RASIO_SISWA_GURU > cfg.AMBANG_SISWA_PER_GURU) {
    masalah.push('GURU_KURANG');
    kalimat.push(
      `Rasio ${fmt(raw.RASIO_SISWA_GURU, 1)} siswa per guru melampaui ambang ${fmt(cfg.AMBANG_SISWA_PER_GURU)}.`
    );
  }
  if (gap > 0 && demand > 0) {
    masalah.push('KAPASITAS_KURANG');
    kalimat.push(
      `Kapasitas ruang kelas saat ini menampung sekitar ${fmt(kapasitasOf(m, cfg))} siswa, sedangkan estimasi kebutuhan ${fmt(demand)} siswa (kekurangan sekitar ${fmt(gap)} kursi).`
    );
  }
  if (isNum(raw.AKSES_BLANK_SPOT) && raw.AKSES_BLANK_SPOT >= cfg.AMBANG_BLANK_SPOT_PCT) {
    masalah.push('AKSES_TERBATAS');
    kalimat.push(
      `${fmt(raw.AKSES_BLANK_SPOT, 1)}% luas wilayah berada di luar jangkauan ${fmt(cfg.COVERAGE_RADIUS_KM, 1)} km dari sekolah terdekat.`
    );
  }

  const faktorUtama = indikator
    .map((ind) => ({
      kode: ind.kode_indikator,
      nama: ind.nama_indikator,
      satuan: ind.satuan,
      nilai: round(raw[ind.kode_indikator], 2),
      kontribusi: round(kontribusi ? kontribusi[ind.kode_indikator] : 0, 2),
    }))
    .filter((f) => isNum(f.kontribusi) && f.kontribusi > 0)
    .sort((a, b) => b.kontribusi - a.kontribusi)
    .slice(0, 3);

  if (kalimat.length === 0) {
    kalimat.push('Tidak ditemukan masalah menonjol pada indikator yang tersedia; kondisi layanan relatif memadai.');
  }
  if (faktorUtama.length > 0) {
    kalimat.push(`Faktor yang paling mempengaruhi skor: ${faktorUtama.map((f) => f.nama).join(', ')}.`);
  }

  const catatanData = [];
  const tanpaKelas = toNum(m.sekolah_tanpa_data_kelas) || 0;
  const tanpaGuru = toNum(m.sekolah_tanpa_data_guru) || 0;
  if (tanpaKelas > 0 && sekolah > 0) {
    catatanData.push(
      `Data ruang kelas belum tersedia untuk ${fmt(tanpaKelas)} dari ${fmt(sekolah)} sekolah; kapasitasnya dianggap setara jumlah siswanya dan tidak masuk rasio siswa per kelas.`
    );
  }
  if (tanpaGuru > 0 && sekolah > 0) {
    catatanData.push(`Data guru belum tersedia untuk ${fmt(tanpaGuru)} dari ${fmt(sekolah)} sekolah; tidak masuk rasio siswa per guru.`);
  }

  return {
    ringkasan: `${nama ? nama + ': ' : ''}${kalimat.join(' ')}`.trim(),
    masalah,
    faktor_utama: faktorUtama,
    catatan_data: catatanData,
  };
}

function recommendIntervensi(metrics, cfg = defaultConfig) {
  const m = metrics || {};
  const raw = deriveIndicators(m, cfg);
  const gap = gapKursiOf(m, cfg);
  const kapasitasSekolahBaru = cfg.SEKOLAH_BARU_RUANG_KELAS * cfg.SISWA_PER_ROMBEL;
  const pc = parts(m);
  const sekolah = pc.sekolah;
  const siswa = pc.siswaKelas;
  const siswaGuru = pc.siswaGuru;
  const guru = pc.guru;
  const ruang = pc.ruang;
  const out = [];

  const butuhSekolahBaru =
    sekolah === 0 || gap >= kapasitasSekolahBaru || (isNum(raw.AKSES_BLANK_SPOT) && raw.AKSES_BLANK_SPOT >= 50);
  if (butuhSekolahBaru) {
    const byGap = Math.floor(gap / kapasitasSekolahBaru);
    out.push({
      tipe: 'Sekolah Baru',
      prioritas: 1,
      jumlah: Math.max(1, byGap),
      alasan:
        sekolah === 0
          ? 'Belum ada sekolah SMP di wilayah ini.'
          : gap >= kapasitasSekolahBaru
            ? `Kekurangan kapasitas sekitar ${fmt(gap)} kursi setara ${fmt(gap / kapasitasSekolahBaru, 1)} sekolah standar.`
            : `${fmt(raw.AKSES_BLANK_SPOT, 1)}% wilayah berada di luar jangkauan sekolah.`,
    });
  }

  if (isNum(raw.RASIO_SISWA_KELAS) && raw.RASIO_SISWA_KELAS > cfg.SISWA_PER_ROMBEL && ruang > 0) {
    const butuh = Math.ceil(siswa / cfg.SISWA_PER_ROMBEL) - ruang;
    out.push({
      tipe: 'Penambahan Ruang Kelas',
      prioritas: butuhSekolahBaru ? 2 : 1,
      jumlah: Math.max(1, butuh),
      alasan: `Ruang kelas terisi rata-rata ${fmt(raw.RASIO_SISWA_KELAS, 1)} siswa; dibutuhkan sekitar ${fmt(Math.max(1, butuh))} ruang kelas tambahan agar sesuai acuan ${fmt(cfg.SISWA_PER_ROMBEL)} siswa per rombel.`,
    });
  }

  if (isNum(raw.RASIO_SISWA_GURU) && raw.RASIO_SISWA_GURU > cfg.AMBANG_SISWA_PER_GURU && guru > 0) {
    const butuh = Math.ceil(siswaGuru / cfg.AMBANG_SISWA_PER_GURU) - guru;
    out.push({
      tipe: 'Penambahan Guru',
      prioritas: 2,
      jumlah: Math.max(1, butuh),
      alasan: `Rasio ${fmt(raw.RASIO_SISWA_GURU, 1)} siswa per guru; sekitar ${fmt(Math.max(1, butuh))} guru tambahan dibutuhkan untuk mencapai ambang ${fmt(cfg.AMBANG_SISWA_PER_GURU)}.`,
    });
  }

  if (!butuhSekolahBaru && isNum(raw.AKSES_BLANK_SPOT) && raw.AKSES_BLANK_SPOT >= cfg.AMBANG_BLANK_SPOT_PCT) {
    out.push({
      tipe: 'Peningkatan Akses & Transportasi',
      prioritas: 2,
      jumlah: null,
      alasan: `Kapasitas relatif cukup, tetapi ${fmt(raw.AKSES_BLANK_SPOT, 1)}% wilayah berada di luar jangkauan sekolah. Pertimbangkan perbaikan akses jalan, angkutan sekolah, atau zonasi.`,
    });
  }

  if (out.length === 0) {
    out.push({
      tipe: 'Pemantauan Berkala',
      prioritas: 3,
      jumlah: null,
      alasan: 'Indikator berada dalam batas wajar; cukup dipantau setiap pembaruan data.',
    });
  }
  return out.sort((a, b) => a.prioritas - b.prioritas);
}

// ---------------------------------------------------------------------------
// Simulasi "bagaimana-jika"
// ---------------------------------------------------------------------------

function snapshot(m, indikator, stats, cfg) {
  const raw = deriveIndicators(m, cfg);
  const norm = {};
  indikator.forEach((ind) => {
    norm[ind.kode_indikator] = normalizeValue(raw[ind.kode_indikator], stats[ind.kode_indikator] || { min: 0, max: 0 }, ind.arah_pengaruh);
  });
  const { skor } = weightedScore(norm, indikator);
  return {
    metrik: m,
    indikator: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round(v, 2)])),
    norm: Object.fromEntries(Object.entries(norm).map(([k, v]) => [k, round(v, 4)])),
    skor: round(skor, 2),
    kategori: categorize(skor, cfg),
    demand: round(demandOf(m, cfg), 0),
    kapasitas: round(kapasitasOf(m, cfg), 0),
    gap_kursi: round(gapKursiOf(m, cfg), 0),
  };
}

/**
 * Simulasi dampak intervensi terhadap satu wilayah.
 * Normalisasi memakai rentang (min/max) kondisi dasar seluruh wilayah, sehingga
 * skor "sebelum" sama dengan skor tersimpan dan perbandingannya apple-to-apple.
 *
 * skenario: { sekolah_baru, ruang_kelas, guru, ruang_kelas_per_sekolah, guru_per_sekolah,
 *             serap_kebutuhan (default true), blank_pct_after, jarak_after }
 */
function simulate({ metrics, skenario, indikator, stats, cfg = defaultConfig }) {
  const s = skenario || {};
  const sekolahBaru = Math.max(0, toNum(s.sekolah_baru) || 0);
  const perSekolahKelas = toNum(s.ruang_kelas_per_sekolah) ?? cfg.SEKOLAH_BARU_RUANG_KELAS;
  const perSekolahGuru = toNum(s.guru_per_sekolah) ?? cfg.SEKOLAH_BARU_GURU;
  const tambahKelas = Math.max(0, toNum(s.ruang_kelas) || 0) + sekolahBaru * perSekolahKelas;
  const tambahGuru = Math.max(0, toNum(s.guru) || 0) + sekolahBaru * perSekolahGuru;
  const tambahKapasitas = tambahKelas * cfg.SISWA_PER_ROMBEL;

  const before = snapshot(metrics, indikator, stats, cfg);

  const after = { ...metrics };
  after.jumlah_sekolah = (toNum(metrics.jumlah_sekolah) || 0) + sekolahBaru;
  after.jumlah_ruang_kelas = (toNum(metrics.jumlah_ruang_kelas) || 0) + tambahKelas;
  after.jumlah_guru = (toNum(metrics.jumlah_guru) || 0) + tambahGuru;

  // Kapasitas baru terisi oleh anak usia SMP yang sebelumnya belum tertampung
  const serap = s.serap_kebutuhan === undefined ? true : Boolean(s.serap_kebutuhan);
  if (serap) {
    const belumTertampung = Math.max(0, demandOf(metrics, cfg) - (toNum(metrics.jumlah_siswa) || 0));
    const serapan = Math.min(belumTertampung, tambahKapasitas);
    after.jumlah_siswa = (toNum(metrics.jumlah_siswa) || 0) + serapan;
    if (metrics.siswa_dgn_kelas !== undefined && metrics.siswa_dgn_kelas !== null) after.siswa_dgn_kelas = (toNum(metrics.siswa_dgn_kelas) || 0) + serapan;
    if (metrics.siswa_dgn_guru !== undefined && metrics.siswa_dgn_guru !== null) after.siswa_dgn_guru = (toNum(metrics.siswa_dgn_guru) || 0) + serapan;
  }
  // Sekolah baru dianggap langsung memiliki siswa (menurunkan beban per sekolah)
  if (metrics.sekolah_ada_siswa !== undefined && metrics.sekolah_ada_siswa !== null) {
    after.sekolah_ada_siswa = (toNum(metrics.sekolah_ada_siswa) || 0) + sekolahBaru;
  }
  if (isNum(toNum(s.blank_pct_after))) after.blank_pct = toNum(s.blank_pct_after);
  if (isNum(toNum(s.jarak_after))) after.jarak_terdekat_km = toNum(s.jarak_after);

  const afterSnap = snapshot(after, indikator, stats, cfg);

  return {
    before,
    after: afterSnap,
    tambahan: {
      sekolah: sekolahBaru,
      ruang_kelas: tambahKelas,
      guru: tambahGuru,
      kapasitas_kursi: tambahKapasitas,
    },
    perubahan: {
      skor: round(afterSnap.skor - before.skor, 2),
      gap_kursi: round(afterSnap.gap_kursi - before.gap_kursi, 0),
      kategori_berubah: before.kategori !== afterSnap.kategori,
    },
  };
}

// ---------------------------------------------------------------------------
// Area kandidat (suitability)
// ---------------------------------------------------------------------------

/**
 * Menilai satu sel grid. Kriteria yang datanya tidak tersedia dilewati dan bobot
 * dinormalkan ulang. Kriteria batas (eksklusi) membuat sel tidak layak.
 */
function scoreKandidat(cell, ctx) {
  const { tersedia, bobot, batas, radiusKm } = ctx;
  const alasanTolak = [];

  if (isNum(cell.d_sekolah_km) && cell.d_sekolah_km < batas.MIN_JARAK_SEKOLAH_KM) {
    alasanTolak.push('Terlalu dekat dengan sekolah yang sudah ada');
  }
  if (tersedia.kawasan_lindung && cell.di_kawasan_lindung) {
    alasanTolak.push('Berada di kawasan lindung');
  }
  if (tersedia.risiko_bencana && (toNum(cell.risiko) || 0) > batas.MAX_RISIKO_LEVEL) {
    alasanTolak.push('Tingkat risiko bencana tinggi');
  }
  if (tersedia.lereng && (toNum(cell.lereng) || 0) > batas.MAX_LERENG_PCT) {
    alasanTolak.push('Kemiringan lereng terlalu curam');
  }

  const komponen = {
    jarak_sekolah: isNum(cell.d_sekolah_km) ? Math.min(cell.d_sekolah_km / radiusKm, 1) : 1,
    akses_jalan: tersedia.jalan
      ? isNum(cell.d_jalan_km)
        ? 1 - Math.min(cell.d_jalan_km / batas.MAX_JARAK_JALAN_KM, 1)
        : 0
      : null,
    risiko_bencana: tersedia.risiko_bencana ? 1 - Math.min((toNum(cell.risiko) || 0) / 5, 1) : null,
    lereng: tersedia.lereng ? 1 - Math.min((toNum(cell.lereng) || 0) / batas.MAX_LERENG_PCT, 1) : null,
    prioritas_wilayah: isNum(toNum(cell.skor_wilayah)) ? toNum(cell.skor_wilayah) / 100 : null,
  };

  let sumW = 0;
  let acc = 0;
  Object.entries(komponen).forEach(([k, v]) => {
    if (isNum(v) && bobot[k] > 0) {
      sumW += bobot[k];
      acc += bobot[k] * v;
    }
  });

  return {
    layak: alasanTolak.length === 0,
    alasanTolak,
    skor: sumW > 0 ? round((acc / sumW) * 100, 2) : 0,
    komponen: Object.fromEntries(Object.entries(komponen).map(([k, v]) => [k, round(v, 3)])),
  };
}

function haversineKm(lng1, lat1, lng2, lat2) {
  const R = 6371.0088;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Memilih kandidat terbaik: skor tertinggi, dibatasi per wilayah dan jarak minimum antar-kandidat */
function pickTopKandidat(scored, { topN = 10, maxPerWilayah = 3, minSeparationKm = 1.5 } = {}) {
  const sorted = scored.filter((c) => c.layak).sort((a, b) => b.skor - a.skor);
  const picked = [];
  const perWilayah = {};
  for (const c of sorted) {
    if (picked.length >= topN) break;
    if ((perWilayah[c.id_wilayah] || 0) >= maxPerWilayah) continue;
    const tooClose = picked.some((p) => haversineKm(p.lng, p.lat, c.lng, c.lat) < minSeparationKm);
    if (tooClose) continue;
    picked.push(c);
    perWilayah[c.id_wilayah] = (perWilayah[c.id_wilayah] || 0) + 1;
  }
  return picked;
}

module.exports = {
  INDIKATOR_DEFAULT,
  demandOf,
  kapasitasOf,
  gapKursiOf,
  deriveIndicators,
  columnStats,
  normalizeValue,
  categorize,
  weightedScore,
  computeScores,
  diagnose,
  recommendIntervensi,
  simulate,
  scoreKandidat,
  pickTopKandidat,
  haversineKm,
  round,
  toNum,
};
