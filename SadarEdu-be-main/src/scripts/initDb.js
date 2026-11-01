// Menjalankan schema.sql ke database (idempotent). Pemakaian: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.sql'), 'utf8');
    await db.query(sql);
    console.log('✅ schema.sql berhasil dijalankan.');
  } catch (e) {
    console.error('❌ Gagal menjalankan schema.sql:', e.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
