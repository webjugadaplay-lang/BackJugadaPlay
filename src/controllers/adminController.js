// controllers/adminController.js
const Room = require('../models/Room');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { Op } = require('sequelize');

// Obtener partidos activos (status = 'active')
exports.getLiveMatches = async (req, res) => {
  try {
    console.log("🔍 getLiveMatches - Iniciando búsqueda...");

    // Obtener partidos activos sin incluir la relación (para evitar error de alias)
    const matches = await Room.findAll({
      where: {
        status: "active",
      },
      order: [["match_date", "ASC"]],
    });

    console.log(`📦 Partidos encontrados: ${matches.length}`);

    // Obtener los datos del bar para cada partido manualmente
    const matchesWithBar = [];
    for (const match of matches) {
      let barData = null;
      if (match.bar_id) {
        const bar = await User.findByPk(match.bar_id, {
          attributes: ["id", "name", "bar_name"]
        });
        if (bar) {
          barData = {
            id: bar.id,
            name: bar.name,
            bar_name: bar.bar_name
          };
        }
      }
      
      matchesWithBar.push({
        id: match.id,
        name: match.name,
        team_home: match.team_home,
        team_away: match.team_away,
        match_date: match.match_date,
        current_score_home: match.current_score_home || 0,
        current_score_away: match.current_score_away || 0,
        status: match.status,
        bar: barData,
      });
    }

    return res.json({
      success: true,
      data: matchesWithBar,
    });
  } catch (error) {
    console.error("❌ Error al obtener partidos activos:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener partidos activos",
    });
  }
};

// Actualizar marcador en vivo
exports.updateLiveScore = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { current_score_home, current_score_away } = req.body;

    if (
      current_score_home === undefined ||
      current_score_away === undefined ||
      current_score_home < 0 ||
      current_score_away < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Marcador inválido",
      });
    }

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Partido no encontrado",
      });
    }

    room.current_score_home = Number(current_score_home);
    room.current_score_away = Number(current_score_away);
    await room.save();

    return res.json({
      success: true,
      message: "Marcador actualizado correctamente",
      data: room,
    });
  } catch (error) {
    console.error("Error al actualizar marcador:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar marcador",
    });
  }
};

// Actualizar estado de la sala
exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "active", "finished", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido",
      });
    }

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Partido no encontrado",
      });
    }

    room.status = status;
    await room.save();

    return res.json({
      success: true,
      message: "Estado actualizado correctamente",
      data: room,
    });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar estado",
    });
  }
};