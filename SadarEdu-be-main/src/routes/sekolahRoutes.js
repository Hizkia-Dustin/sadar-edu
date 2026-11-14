/**
 * ============================================================================
 * RUTE: /api/v1/sekolah
 * ============================================================================
 * Layanan data sekolah spasial dan statistik pendidikan:
 * - Publik (tanpa login): mengambil data GeoJSON sekolah, sekolah terdekat, alternatif
 * - Operator (dengan token): membuat, memperbarui satuan (PUT /:id), dan menghapus sekolah
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const c = require('../controllers/sekolahController');
const { operatorOnly } = require('../middleware/auth');

// Rute Publik
router.get('/geojson', c.getAllSekolahGeoJSON);           // Ambil seluruh titik sekolah (GeoJSON)
router.get('/nearby', c.getSekolahNearby);                 // Pencarian sekolah terdekat dari koordinat
router.get('/statistik', c.getStatistikPendidikan);        // Data statistik pendidikan (siswa, guru, dsb)
router.get('/:id', c.getSekolahById);                      // Detail profil sekolah & riwayat statistik
router.get('/:id/alternatif', c.getAlternatif);            // Alternatif sekolah dalam radius tertentu

// Rute Khusus Operator (Dilindungi Middleware operatorOnly)
router.post('/statistik', ...operatorOnly, c.createStatistikPendidikan); // Tambah statistik sekolah
router.post('/', ...operatorOnly, c.createSekolah);                      // Tambah 1 sekolah baru manual
router.put('/:id', ...operatorOnly, c.updateSekolah);                    // Update 1 sekolah (nama/alamat/koordinat)
router.delete('/:id', ...operatorOnly, c.deleteSekolah);                 // Hapus 1 sekolah dari database

module.exports = router;
