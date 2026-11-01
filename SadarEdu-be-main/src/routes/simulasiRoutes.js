const express = require('express');
const router = express.Router();
const c = require('../controllers/simulasiController');
const { staffOnly } = require('../middleware/auth');

router.get('/scenarios', ...staffOnly, c.getScenarios);
router.post('/scenarios', ...staffOnly, c.createScenario);
router.delete('/scenarios/:id', ...staffOnly, c.deleteScenario);

module.exports = router;
