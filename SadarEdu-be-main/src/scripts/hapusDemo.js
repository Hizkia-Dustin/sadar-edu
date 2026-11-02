// Menghapus SEMUA dataset demo (sumber berawalan "DEMO") beserta skor/kandidat/skenario turunannya.
// Jalankan sebelum mengunggah data asli agar data sintetis tidak tercampur. Pemakaian: npm run demo:hapus
require('dotenv').config();
const db = require('../config/db');
const dataset = require('../services/datasetService');

(async () => {
  try {
    const lama = await db.query(`SELECT id_dataset, nama_dataset FROM dataset_metadata WHERE sumber ILIKE 'DEMO%'`);
    if (lama.rows.length === 0) {
      console.log('Tidak ada dataset demo.');
      return;
    }
    for (const r of lama.rows) {
      const h = await dataset.deleteDataset(r.id_dataset);
      console.log(`🧹 ${r.nama_dataset}: ${h.baris_terhapus} baris dihapus`);
    }
    await db.query('DELETE FROM candidate_area');
    await db.query('DELETE FROM scenario_intervensi');
    await db.query('DELETE FROM priority_score');
    await db.query('DELETE FROM nilai_indikator');
    console.log('✅ Data demo dan hasil analisisnya dibersihkan. Silakan unggah data asli.');
  } catch (e) {
    console.error('❌ Gagal:', e.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
