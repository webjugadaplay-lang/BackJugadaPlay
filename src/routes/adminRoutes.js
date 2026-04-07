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

module.exports = router;