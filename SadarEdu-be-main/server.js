require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/db');
const seedRoles = require('./src/config/seedRoles');
const seedIndikator = require('./src/config/seedIndikator');

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET wajib diisi pada mode production.');
  process.exit(1);
}

db.query('SELECT NOW(), PostGIS_Full_Version()')
  .then(async (res) => {
    console.log('🐘 PostgreSQL time:', res.rows[0].now);
    console.log('🗺️  PostGIS:', res.rows[0].postgis_full_version);
    await seedRoles();
    await seedIndikator();
    app.listen(PORT, () => {
      console.log(`🚀 SadarEdu API berjalan di http://localhost:${PORT}`);
      console.log(`📌 Health check: http://localhost:${PORT}/api/v1/health`);
    });
  })
  .catch((err) => {
    console.error('❌ Koneksi database gagal:', err.message);
    console.log('⚠️  Server tetap dijalankan, tetapi endpoint data akan error sampai PostgreSQL/PostGIS tersambung.');
    app.listen(PORT, () => console.log(`🚀 Server di http://localhost:${PORT} (tanpa database)`));
  });
