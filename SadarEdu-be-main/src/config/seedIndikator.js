const db = require('./db');
const { INDIKATOR_DEFAULT } = require('../services/scoring');

// Mengisi katalog indikator bila belum ada. Tidak menimpa bobot yang sudah diubah Stakeholder.
const seedIndikator = async () => {
  try {
    for (const i of INDIKATOR_DEFAULT) {
      await db.query(
        `INSERT INTO indikator (kode_indikator, nama_indikator, satuan, arah_pengaruh, bobot, kelompok, deskripsi)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (kode_indikator) DO UPDATE
           SET nama_indikator = EXCLUDED.nama_indikator, satuan = EXCLUDED.satuan,
               kelompok = EXCLUDED.kelompok, deskripsi = EXCLUDED.deskripsi`,
        [i.kode_indikator, i.nama_indikator, i.satuan, i.arah_pengaruh, i.bobot, i.kelompok, i.deskripsi]
      );
    }
    console.log('✅ Seed master INDIKATOR berhasil disinkronkan.');
  } catch (error) {
    console.error('⚠️  Gagal seed INDIKATOR (sudah menjalankan schema.sql versi terbaru?):', error.message);
  }
};

module.exports = seedIndikator;
