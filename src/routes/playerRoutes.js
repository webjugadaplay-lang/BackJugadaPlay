const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { getMatchResult } = require('../controllers/playerController');

const router = express.Router();

// Ruta para obtener resultado de un partido
router.get('/match-result/:roomId', authenticateToken, getMatchResult);

module.exports = router;