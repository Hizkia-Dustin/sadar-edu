const express = require('express');
const router = express.Router();
const c = require('../controllers/candidateAreaController');
const { staffOnly } = require('../middleware/auth');

// Area kandidat adalah bahan pertimbangan stakeholder, bukan informasi publik
router.get('/geojson', ...staffOnly, c.getCandidateAreasGeoJSON);
router.post('/generate', ...staffOnly, c.generate);
router.patch('/:id', ...staffOnly, c.updateStatus);
router.delete('/:id', ...staffOnly, c.remove);

module.exports = router;
