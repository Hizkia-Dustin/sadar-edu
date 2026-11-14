const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS: CORS_ORIGIN berisi daftar origin FE dipisah koma (mis. https://sadaredu.vercel.app,http://localhost:5173).
// Jika kosong -> semua origin diizinkan (hanya cocok untuk pengembangan).
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(helmet());
app.use(express.json({ limit: '50mb' })); // dataset GeoJSON besar (hanya Operator yang mengunggah)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/api/v1', apiRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Selamat datang di SadarEdu RESTful API (PostgreSQL + PostGIS)', docs: '/api/v1/health' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint ${req.originalUrl} tidak ditemukan.` });
});

app.use(errorHandler);

module.exports = app;
