// controllers/adminController.js
const { Room, User, Prediction } = require("../models");
const { Op } = require("sequelize");

exports.getLiveMatches = async (req, res) => {
  try {
    const now = new Date();

    const matches = await Room.findAll({
      where: {
        match_date: { [Op.lte]: now },
        status: "active",
      },
      include: [
        {
          model: User,
          as: "bar",
          attributes: ["id", "name", "bar_name"],
        },
      ],
      order: [["match_date", "DESC"]],
    });

    return res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error("Error al obtener partidos activos:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener partidos activos",
    });
  }
};

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

    // Aquí puedes recalcular ranking en vivo si tienes lógica montada
    // await recalculateLiveRanking(room.id);

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

    if (status === "finished") {
      room.result_score_home = room.current_score_home;
      room.result_score_away = room.current_score_away;
    }

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