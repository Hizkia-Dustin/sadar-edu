const svc = require('../services/datasetService');
const analysis = require('../services/analysisService');
const { httpError } = require('../middleware/errorHandler');

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

const kategori = wrap(async (req, res) => {
  res.json({ success: true, data: Object.entries(svc.KATEGORI).map(([kode, d]) => ({ kode, label: d.label, tabel: d.tabel, format: d.format, memengaruhi_analisis: d.memengaruhiAnalisis })) });
});

const list = wrap(async (req, res) => {
  const data = await svc.listDatasets();
  res.json({ success: true, count: data.length, data });
});

// Body: { kategori, nama_dataset, sumber, tahun, format, crs, data, hitung_ulang }
const importData = wrap(async (req, res) => {
  const hasil = await svc.importDataset(req.body, req.user.id_user);
  let analisis = null;
  let analisisError = null;
  if (hasil.memengaruhi_analisis && req.body.hitung_ulang !== false) {
    try {
      analisis = await analysis.recalculate({ tahun: req.body.tahun });
    } catch (e) {
      // Data tetap tersimpan; analisis dapat dijalankan ulang setelah data lengkap (mis. wilayah belum diunggah)
      analisisError = e.message;
    }
  }
  res.status(201).json({
    success: true,
    message: 'Dataset berhasil diimpor.',
    data: hasil,
    analisis,
    analisis_catatan: analisisError,
  });
});

const setAktif = wrap(async (req, res) => {
  if (typeof (req.body || {}).aktif !== 'boolean') throw httpError(400, 'Body harus berisi aktif (true/false).');
  const data = await svc.setDatasetAktif(req.params.id, req.body.aktif);
  res.json({ success: true, data, perlu_hitung_ulang: true });
});

const remove = wrap(async (req, res) => {
  const data = await svc.deleteDataset(req.params.id);
  res.json({ success: true, message: 'Dataset dan datanya dihapus.', data, perlu_hitung_ulang: true });
});

module.exports = { kategori, list, importData, setAktif, remove };
