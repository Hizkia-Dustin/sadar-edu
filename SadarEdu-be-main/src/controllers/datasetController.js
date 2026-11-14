/**
 * ============================================================================
 * CONTROLLER: DATASET SPASIAL & ATRIBUT (OPERATOR)
 * ============================================================================
 * Menangani operasi siklus hidup dataset pada database PostgreSQL:
 * 1. Daftar katalog kategori dataset (sekolah, wilayah, jaringan jalan, dsb.)
 * 2. Daftar riwayat dataset per tahun/periode (multi-versi)
 * 3. Impor massal dataset (CSV/GeoJSON) dengan konversi otomatis ke PostGIS
 * 4. Gonta-ganti status aktif/nonaktif dataset per tahun (PATCH /dataset/:id)
 * 5. Hapus dataset beserta fitur spasial terkait (DELETE /dataset/:id)
 * ============================================================================
 */

const svc = require('../services/datasetService');
const analysis = require('../services/analysisService');
const { httpError } = require('../middleware/errorHandler');

// Pembungkus handler async agar error otomatis diteruskan ke middleware errorHandler
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/v1/dataset/kategori
 * Mengembalikan daftar kategori dataset yang didukung beserta tabel target dan formatnya.
 */
const kategori = wrap(async (req, res) => {
  res.json({
    success: true,
    data: Object.entries(svc.KATEGORI).map(([kode, d]) => ({
      kode,
      label: d.label,
      tabel: d.tabel,
      format: d.format,
      memengaruhi_analisis: d.memengaruhiAnalisis,
    })),
  });
});

/**
 * GET /api/v1/dataset
 * Mengambil seluruh riwayat versi dataset yang tersimpan di tabel `dataset_metadata` PostgreSQL.
 * Digunakan oleh halaman kelola dataset operator untuk menampilkan histori versi tahunan.
 */
const list = wrap(async (req, res) => {
  const data = await svc.listDatasets();
  res.json({ success: true, count: data.length, data });
});

/**
 * POST /api/v1/dataset/import
 * Impor dataset baru (massal) baik berformat CSV tabel maupun GeoJSON poligon/titik.
 * Body: { kategori, nama_dataset, sumber, tahun, format, crs, data, hitung_ulang }
 * Fungsi:
 * - Mengubah koordinat (lat, lng) menjadi geometri PostGIS (EPSG:4326)
 * - Menghubungkan titik sekolah ke poligon kecamatan terdekat via spatial query
 * - Menjalankan analisis ulang kebutuhan sekolah jika diminta
 */
const importData = wrap(async (req, res) => {
  const hasil = await svc.importDataset(req.body, req.user.id_user);
  let analisis = null;
  let analisisError = null;

  // Jika dataset memengaruhi analisis (mis. data sekolah, penduduk, atau batas wilayah)
  if (hasil.memengaruhi_analisis && req.body.hitung_ulang !== false) {
    try {
      analisis = await analysis.recalculate({ tahun: req.body.tahun });
    } catch (e) {
      // Data tetap tersimpan aman; analisis dapat dijalankan ulang saat data pendukung lengkap
      analisisError = e.message;
    }
  }

  res.status(201).json({
    success: true,
    message: 'Dataset berhasil diimpor ke database PostgreSQL/PostGIS.',
    data: hasil,
    analisis,
    analisis_catatan: analisisError,
  });
});

/**
 * PATCH /api/v1/dataset/:id
 * Mengaktifkan atau menonaktifkan versi dataset (Gonta-Ganti Versi).
 * Body: { aktif: true / false }
 * Ketika versi dataset diaktifkan, layer peta dan modul analisis akan menjadikannya data acuan.
 */
const setAktif = wrap(async (req, res) => {
  if (typeof (req.body || {}).aktif !== 'boolean') {
    throw httpError(400, 'Body harus berisi boolean aktif (true/false).');
  }
  const data = await svc.setDatasetAktif(req.params.id, req.body.aktif);
  res.json({ success: true, message: `Status dataset #${req.params.id} berhasil diperbarui.`, data, perlu_hitung_ulang: true });
});

/**
 * DELETE /api/v1/dataset/:id
 * Menghapus dataset beserta seluruh record fitur spasial di tabel terkait (cascade clean-up).
 * Digunakan operator untuk membersihkan dataset duplikat atau berkas uji coba usang.
 */
const remove = wrap(async (req, res) => {
  const data = await svc.deleteDataset(req.params.id);
  res.json({
    success: true,
    message: 'Dataset dan seluruh data spasial terkait berhasil dihapus dari database.',
    data,
    perlu_hitung_ulang: true,
  });
});

module.exports = { kategori, list, importData, setAktif, remove };
