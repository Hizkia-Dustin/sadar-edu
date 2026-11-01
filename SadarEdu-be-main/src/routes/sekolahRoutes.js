const express = require('express');
const router = express.Router();
const c = require('../controllers/sekolahController');
const { operatorOnly } = require('../middleware/auth');

// Rute statis harus di atas '/:id'
router.get('/geojson', c.getAllSekolahGeoJSON);
router.get('/nearby', c.getSekolahNearby);
router.get('/statistik', c.getStatistikPendidikan);
router.post('/statistik', ...operatorOnly, c.createStatistikPendidikan);
router.post('/', ...operatorOnly, c.createSekolah);
router.get('/:id', c.getSekolahById);
router.get('/:id/alternatif', c.getAlternatif);
router.put('/:id', ...operatorOnly, c.updateSekolah);
router.delete('/:id', ...operatorOnly, c.deleteSekolah);

module.exports = router;
