/**
 * ============================================================================
 * RUTE: /api/v1/dataset (Hanya untuk peran Operator)
 * ============================================================================
 * Mengatur pengelolaan dataset spasial dan atribut di database PostgreSQL.
 * Semua rute di file ini diproteksi oleh middleware `operatorOnly`.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const c = require('../controllers/datasetController');
const { operatorOnly } = require('../middleware/auth');

// Hanya akun dengan role Operator yang berhak mengakses rute dataset
router.use(...operatorOnly);

// 1. Ambil daftar katalog kategori dataset (sekolah, wilayah, jalan, dll)
router.get('/kategori', c.kategori);

// 2. Ambil seluruh riwayat versi dataset di PostgreSQL (untuk tabel kelola dataset)
router.get('/', c.list);

// 3. Impor dataset baru (massal per tahun, CSV/GeoJSON -> PostGIS)
router.post('/import', c.importData);

// 4. Gonta-ganti versi aktif: aktifkan atau nonaktifkan dataset tertentu
router.patch('/:id', c.setAktif);

// 5. Hapus dataset dan bersihkan data spasial terkait dari database
router.delete('/:id', c.remove);

module.exports = router;
