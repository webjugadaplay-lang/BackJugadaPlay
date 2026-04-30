const express = require('express');
const router = express.Router();
const { register, login, forgotPassword, verifyResetToken, resetPassword  } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

module.exports = router;