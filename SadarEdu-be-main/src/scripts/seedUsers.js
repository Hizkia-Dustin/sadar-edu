// Membuat akun awal Operator & Stakeholder. Pemakaian: npm run seed:users
// Kredensial dibaca dari .env; ganti password default sebelum dipakai di luar pengembangan.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const seedRoles = require('../config/seedRoles');

const akun = [
  { nama: process.env.SEED_OPERATOR_NAMA || 'Operator SADAR Edu', email: process.env.SEED_OPERATOR_EMAIL || 'operator@sadaredu.id', password: process.env.SEED_OPERATOR_PASSWORD || 'ganti-password-operator', id_role: 3 },
  { nama: process.env.SEED_STAKEHOLDER_NAMA || 'Stakeholder Dinas Pendidikan', email: process.env.SEED_STAKEHOLDER_EMAIL || 'stakeholder@sadaredu.id', password: process.env.SEED_STAKEHOLDER_PASSWORD || 'ganti-password-stakeholder', id_role: 2 },
];

(async () => {
  try {
    await seedRoles();
    for (const a of akun) {
      const hash = await bcrypt.hash(a.password, 10);
      const r = await db.query(
        `INSERT INTO user_account (nama, email, password_hash, id_role) VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET nama = EXCLUDED.nama, password_hash = EXCLUDED.password_hash, id_role = EXCLUDED.id_role
         RETURNING email`,
        [a.nama, a.email.toLowerCase(), hash, a.id_role]
      );
      console.log(`✅ Akun siap: ${r.rows[0].email}`);
    }
  } catch (e) {
    console.error('❌ Gagal membuat akun:', e.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
