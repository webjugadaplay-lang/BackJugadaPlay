const express = require('express');
const router = express.Router();
const barController = require('../controllers/barController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Verificar que el usuario es un bar
router.use((req, res, next) => {
  if (req.user.role !== 'bar') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requiere rol de bar.',
    });
  }
  next();
});

// Rutas del bar
router.get('/stats', barController.getBarStats);
router.get('/rooms', barController.getBarRooms);
router.post('/rooms', barController.createRoom);
router.get('/rooms/:id', barController.getRoomDetails);
router.put('/rooms/:id/close', barController.closePredictions);

module.exports = router;