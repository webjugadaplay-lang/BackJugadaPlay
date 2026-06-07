const sequelize = require('../config/database');
const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const Fixture = require('../models/Fixture');

const getMatchResult = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verificar que el usuario participó en esta sala
    const prediction = await Prediction.findOne({
      where: { room_id: roomId, user_id: userId }
    });

    if (!prediction) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta sala'
      });
    }

    // Obtener la sala con el fixture (para resultados)
    const room = await Room.findByPk(roomId, {
      include: [{
        model: Fixture,
        as: 'Fixture',
        attributes: ['goals_home', 'goals_away']
      }]
    });

    if (!room || room.status !== 'finished') {
      return res.status(404).json({
        success: false,
        message: 'Resultado no disponible aún'
      });
    }

    // Contar ganadores
    const winners = await Prediction.findAll({
      where: {
        room_id: roomId,
        goals_home: room.Fixture.goals_home,
        goals_away: room.Fixture.goals_away,
        is_paid: true
      }
    });

    const winnersCount = winners.length;
    const totalPrize = winnersCount > 0 ? (room.total_pool * 0.7) / winnersCount : 0;

    res.json({
      success: true,
      data: {
        id: room.id,
        room_id: room.id,
        score_home: room.Fixture.goals_home || 0,
        score_away: room.Fixture.goals_away || 0,
        winners_count: winnersCount,
        total_prize: Math.round(totalPrize)
      }
    });

  } catch (error) {
    console.error('Error en getMatchResult:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resultado del partido'
    });
  }
};

module.exports = { getMatchResult };