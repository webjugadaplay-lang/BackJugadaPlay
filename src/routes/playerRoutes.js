const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getMatchResult } = require('../controllers/playerController');

const router = express.Router();

// Rutas protegidas
router.use(authMiddleware);

// Ruta para obtener resultado de un partido
router.get('/match-result/:roomId', authenticateToken, getMatchResult);

module.exports = router;