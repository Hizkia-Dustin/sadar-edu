const express = require('express');
const router = express.Router();
const c = require('../controllers/indikatorController');
const { staffOnly, operatorOnly } = require('../middleware/auth');

router.get('/', c.getAllIndikator);
router.post('/', ...operatorOnly, c.createIndikator);
router.put('/bobot', ...staffOnly, c.updateBobot);
router.get('/priority-scores', c.getPriorityScores);

module.exports = router;
