// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");

// Todas las rutas requieren autenticación y rol de administrador
router.use(verifyToken);
router.use(requireAdmin);

router.get("/live-matches", adminController.getLiveMatches);
router.patch("/rooms/:roomId/score", adminController.updateLiveScore);
router.patch("/rooms/:roomId/status", adminController.updateRoomStatus);

module.exports = router;