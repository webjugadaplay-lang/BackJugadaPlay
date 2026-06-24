// routes/playerRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getMatchResult, getLiveRoomData } = require('../controllers/playerController');

const router = express.Router();

// ✅ Todas las rutas usan el mismo middleware
router.use(authMiddleware);

// Ruta para obtener resultado de un partido
router.get('/match-result/:roomId', getMatchResult);

// Ruta para obtener datos de la sala en vivo con ranking
router.get('/live-room/:roomId', getLiveRoomData);

module.exports = router;