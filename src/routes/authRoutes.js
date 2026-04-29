const express = require('express');
const router = express.Router();
const { register, login, forgotPassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword); // ← Nueva ruta

module.exports = router;