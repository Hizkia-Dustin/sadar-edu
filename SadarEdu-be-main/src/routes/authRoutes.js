const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, operatorOnly } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authenticateToken, authController.getProfile);
router.get('/users', ...operatorOnly, authController.listUsers);
router.post('/users', ...operatorOnly, authController.createUser);

module.exports = router;
