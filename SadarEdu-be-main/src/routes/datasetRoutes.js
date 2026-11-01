const express = require('express');
const router = express.Router();
const c = require('../controllers/datasetController');
const { operatorOnly } = require('../middleware/auth');

router.use(...operatorOnly);
router.get('/kategori', c.kategori);
router.get('/', c.list);
router.post('/import', c.importData);
router.patch('/:id', c.setAktif);
router.delete('/:id', c.remove);

module.exports = router;
