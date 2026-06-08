// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");

// Middleware de autenticación y verificación de rol admin
const verifyToken = authMiddleware;
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requiere rol de administrador.'
    });
  }
};

// Todas las rutas requieren autenticación y rol de administrador
router.use(verifyToken);
router.use(requireAdmin);

router.get("/live-matches", adminController.getLiveMatches);
router.patch("/rooms/:roomId/score", adminController.updateLiveScore);
router.patch("/rooms/:roomId/status", adminController.updateRoomStatus);
router.post("/rooms/:roomId/calculate-winners", adminController.calculateWinners);
router.post("/sync", adminController.syncFixtures);
router.get("/fixtures", adminController.getFixtures);
router.get("/leagues", adminController.getLeagues);
router.get("/live-fixtures", adminController.getLiveFixtures);
router.get("/available-leagues", adminController.getAvailableLeagues);
router.post("/add-leagues", adminController.addLeagues);
router.get("/user-leagues", adminController.getUserLeagues);

// Endpoint para actualizar marcador vía HTTP (fallback)
router.put('/update-score/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { goals_home, goals_away } = req.body;

    // Verificar que el usuario es admin o bar
    if (req.user.role !== 'admin' && req.user.role !== 'bar') {
      return res.status(403).json({
        success: false,
        message: 'No autorizado'
      });
    }

    // Obtener el fixture_id de la sala
    const [room] = await sequelize.query(
      `SELECT fixture_id FROM rooms WHERE id = :roomId`,
      { replacements: { roomId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!room || !room.fixture_id) {
      return res.status(404).json({
        success: false,
        message: 'Sala no tiene fixture asociado'
      });
    }

    // Actualizar el fixture
    await sequelize.query(
      `UPDATE fixtures 
       SET goals_home = :goals_home, 
           goals_away = :goals_away,
           updated_at = NOW()
       WHERE id = :fixtureId`,
      {
        replacements: {
          goals_home,
          goals_away,
          fixtureId: room.fixture_id
        },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    // 🔥 EMITIR VÍA WEBSOCKET
    if (req.io) {
      const roomName = `live-room-${roomId}`;
      req.io.to(roomName).emit('score-updated', {
        goals_home,
        goals_away,
        timestamp: new Date().toISOString()
      });
      console.log(`📡 WebSocket emitido a sala: ${roomName}`);
    }

    res.json({
      success: true,
      message: 'Marcador actualizado',
      data: { goals_home, goals_away }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar marcador'
    });
  }
});

module.exports = router;