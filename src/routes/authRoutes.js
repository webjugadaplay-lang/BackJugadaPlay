// backend/src/routes/authRoutes.js (o donde tengas las rutas)

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Mantener las mismas rutas
router.post('/register', authController.register);
router.post('/login', authController.login); // ✅ Ya soporta email y teléfono
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-token', authController.verifyResetToken);
router.post('/reset-password', authController.resetPassword);

module.exports = router;