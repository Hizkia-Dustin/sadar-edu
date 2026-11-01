const express = require('express');
const router = express.Router();
const c = require('../controllers/analisisController');
const { staffOnly } = require('../middleware/auth');

// Publik (masyarakat dapat melihat kondisi layanan wilayah)
router.get('/prioritas', c.prioritas);
router.get('/blank-spots', c.blankSpots);
router.get('/coverage', c.coverage);
router.get('/ringkasan', c.ringkasan);

// Stakeholder & Operator
router.post('/hitung', ...staffOnly, c.recalculate);
router.get('/intervensi', ...staffOnly, c.intervensi);
router.get('/status', ...staffOnly, c.status);

module.exports = router;
