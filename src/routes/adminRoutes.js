// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");

router.get("/live-matches", verifyToken, requireAdmin, adminController.getLiveMatches);
router.patch("/rooms/:roomId/score", verifyToken, requireAdmin, adminController.updateLiveScore);
router.patch("/rooms/:roomId/status", verifyToken, requireAdmin, adminController.updateRoomStatus);

module.exports = router;