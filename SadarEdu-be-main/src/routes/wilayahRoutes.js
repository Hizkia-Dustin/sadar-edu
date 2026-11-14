const express = require('express');
const router = express.Router();
const wilayahController = require('../controllers/wilayahController');
const { operatorOnly } = require('../middleware/auth');

router.get('/list', wilayahController.listWilayah);
router.get('/geojson', wilayahController.getAllWilayahGeoJSON);
router.get('/:id', wilayahController.getWilayahById);
router.post('/', ...operatorOnly, wilayahController.createWilayah);

module.exports = router;
