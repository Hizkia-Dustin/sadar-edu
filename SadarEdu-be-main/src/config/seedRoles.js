const db = require('./db');

const seedRoles = async () => {
  try {
    const seedQuery = `
      INSERT INTO role (id_role, nama_role, deskripsi) VALUES
      (1, 'Umum', 'Pengguna publik/masyarakat yang memiliki hak akses untuk melihat (read-only) peta spasial SIG, sebaran sekolah, dan informasi umum pendidikan.'),
      (2, 'Stakeholder', 'Pengambil kebijakan atau instansi pemerintah yang memiliki hak akses ke dashboard analisis eksekutif, skor prioritas wilayah, serta fitur simulasi skenario intervensi.'),
      (3, 'Operator', 'Pengelola sistem/administrator data yang memiliki hak akses penuh untuk mengunggah, menginput, mengedit, dan mengelola data master spasial, demografi, serta statistik sekolah.')
      ON CONFLICT (id_role) DO UPDATE 
      SET nama_role = EXCLUDED.nama_role, deskripsi = EXCLUDED.deskripsi;
      
      SELECT setval(pg_get_serial_sequence('role', 'id_role'), COALESCE((SELECT MAX(id_role) FROM role), 1));
    `;
    await db.query(seedQuery);
    console.log('✅ Seed data master ROLE (Umum, Stakeholder, Operator) berhasil disinkronkan.');
  } catch (error) {
    console.error('⚠️  Gagal melakukan auto-seed ROLE:', error.message);
  }
};

module.exports = seedRoles;
