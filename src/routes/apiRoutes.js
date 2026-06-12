const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Modelos
const sequelize = require('../config/database');
const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const Fixture = require('../models/Fixture');
const User = require('../models/User');

// ================= PUBLIC =================

// Buscar sala por código
router.get('/rooms/find-by-code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código de sala requerido'
      });
    }

    console.log(`🔍 Buscando sala con código: ${code}`);

    // Buscar la sala activa por su código
    const room = await Room.findOne({
      where: {
        code: code.toUpperCase(), // Asegurar consistencia en mayúsculas
        status: 'active'
      },
      attributes: ['id', 'code', 'name', 'status'] // Solo lo necesario
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada o no está activa'
      });
    }

    // Retornar el ID de la sala para redirección
    res.json({
      success: true,
      roomId: room.id,
      message: 'Sala encontrada exitosamente'
    });

  } catch (error) {
    console.error('Error en /rooms/find-by-code:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ================= PRIVATE =================
router.use(authMiddleware);

// ===== GET - Obtener predicciones del usuario para una sala =====
router.get('/player/predictions/:roomId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;

    const predictions = await Prediction.findAll({
      where: {
        user_id: userId,
        room_id: roomId
      },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'goals_home', 'goals_away', 'entry_fee_paid', 'is_paid', 'createdAt'] // ✅ Incluir entry_fee_paid
    });

    return res.status(200).json({
      success: true,
      data: predictions.map(p => ({
        id: p.id,
        score_home: p.goals_home,
        score_away: p.goals_away,
        entry_fee_paid: p.entry_fee_paid,  // ✅ Devolver el campo
        paid: p.is_paid,
        created_at: p.createdAt
      }))
    });

  } catch (error) {
    console.error('Error en GET /player/predictions/:roomId:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener las predicciones'
    });
  }
});

// ===== POST - Crear NUEVA predicción (siempre crear, no actualizar) =====
router.post('/player/prediction', async (req, res) => {
  try {
    const userId = req.user.id;
    const { room_id, score_home, score_away, entry_fee_paid } = req.body;

    console.log("📝 Creando nueva predicción:", { userId, room_id, score_home, score_away, entry_fee_paid });

    if (!room_id) {
      return res.status(400).json({
        success: false,
        message: 'room_id es requerido'
      });
    }

    // Verificar que la sala existe y está activa
    const room = await Room.findByPk(room_id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // Verificar que el partido no haya empezado o esté cerrado
    if (room.status === 'finished' || room.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'El partido ya finalizó, no se pueden hacer más predicciones'
      });
    }

    const closeTime = new Date(room.prediction_close_time);
    if (closeTime < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'El tiempo para hacer predicciones ha expirado'
      });
    }

    // Validar que entry_fee_paid esté presente y sea válido
    let finalEntryFee = entry_fee_paid;
    if (!finalEntryFee && finalEntryFee !== 0) {
      // Si no viene del frontend, usar el entry_fee de la sala como fallback
      finalEntryFee = room.entry_fee;
      console.log("⚠️ Usando entry_fee de la sala como fallback:", finalEntryFee);
    }

    // Asegurar que sea número
    const entryFeeValue = typeof finalEntryFee === 'string'
      ? parseFloat(finalEntryFee)
      : finalEntryFee;

    // ✅ SIEMPRE crear una nueva predicción (no actualizar)
    const prediction = await Prediction.create({
      user_id: userId,
      room_id,
      goals_home: score_home,
      goals_away: score_away,
      entry_fee_paid: entryFeeValue,  // ✅ NUEVO CAMPO
      is_paid: false
    });

    console.log("✅ Predicción creada con ID:", prediction.id, "Entry fee:", entryFeeValue);

    return res.status(201).json({
      success: true,
      data: {
        id: prediction.id,
        score_home: prediction.goals_home,
        score_away: prediction.goals_away,
        entry_fee_paid: prediction.entry_fee_paid,
        paid: prediction.is_paid
      }
    });

  } catch (error) {
    console.error('Error en POST /player/prediction:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la predicción'
    });
  }
});

// ===== FUNCIÓN AUXILIAR PARA CALCULAR RANKING CON EMOJIS =====
async function calculateLiveRanking(roomId, realHome, realAway) {
  const predictions = await Prediction.findAll({
    where: { room_id: roomId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'player_nickname']
    }]
  });

  function getEmojiAndStatus(totalError, predHome, predAway, realHome, realAway) {
    const realWinner = realHome > realAway ? 'home' : (realAway > realHome ? 'away' : 'draw');
    const predWinner = predHome > predAway ? 'home' : (predAway > predHome ? 'away' : 'draw');

    if (realWinner !== 'draw' && predWinner !== realWinner) {
      return { emoji: '🥶', status: 'Muerto' };
    }

    if (totalError === 0) return { emoji: '🥳', status: 'Excelente' };
    if (totalError === 1) return { emoji: '😁', status: 'Bien' };
    if (totalError === 2) return { emoji: '🥲', status: 'Regular' };
    if (totalError === 3) return { emoji: '😐', status: 'Ni bien ni mal' };
    if (totalError === 4) return { emoji: '😡', status: 'Mal' };
    return { emoji: '🥶', status: 'Muerto' };
  }

  const ranking = predictions.map(pred => {
    const errorHome = Math.abs(pred.goals_home - realHome);
    const errorAway = Math.abs(pred.goals_away - realAway);
    const totalError = errorHome + errorAway;
    const { emoji, status } = getEmojiAndStatus(totalError, pred.goals_home, pred.goals_away, realHome, realAway);

    return {
      user_id: pred.user_id,
      user_name: pred.User?.player_nickname || pred.User?.name || 'Jugador',
      score_home: pred.goals_home,
      score_away: pred.goals_away,
      total_error: totalError,
      emoji: emoji,
      status: status,
      position: 0
    };
  });

  ranking.sort((a, b) => a.total_error - b.total_error);

  return ranking.map((item, idx) => ({
    ...item,
    position: idx + 1
  }));
}

// ===== Obtener sala en vivo con ranking =====
router.get('/player/live-room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    const fixture = room.fixture_id ? await Fixture.findByPk(room.fixture_id) : null;

    const participants = await RoomParticipant.findAll({
      where: { room_id: roomId },
      order: [['total_points', 'DESC']]
    });

    // Obtener nombres de usuarios
    const participantsWithUsers = await Promise.all(participants.map(async (p) => {
      const user = await User.findByPk(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        user_name: user ? user.name : 'Usuario',
        total_points: p.total_points,
        rank: p.rank,
        joined_at: p.joined_at
      };
    }));

    res.json({
      success: true,
      data: {
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          entry_fee: room.entry_fee,
          total_pool: room.total_pool,
          total_collected: room.total_collected,      // ← NUEVA COLUMNA
          bar_commission: room.bar_commission,        // ← NUEVA COLUMNA
          platform_commission: room.platform_commission, // ← NUEVA COLUMNA
          status: room.status,
          prediction_close_time: room.prediction_close_time,
          current_participants: room.current_participants,
          max_participants: room.max_participants
        },
        fixture: fixture ? {
          id: fixture.id,
          home_team: fixture.home_team_name,
          away_team: fixture.away_team_name,
          match_date: fixture.match_date,
          venue: fixture.venue,
          status: fixture.status
        } : null,
        participants: participantsWithUsers
      }
    });

  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar los detalles de la sala'
    });
  }
});

// ===== GET - Obtener TODAS las predicciones del usuario =====
router.get('/player/my-predictions', async (req, res) => {
  try {
    const userId = req.user.id;

    const predictions = await Prediction.findAll({
      where: { user_id: userId },
      include: [{
        model: Room,
        as: 'room',
        include: [{
          model: Fixture,
          as: 'Fixture',
          attributes: ['home_team_name', 'away_team_name', 'match_date']
        }],
        attributes: ['id', 'name', 'entry_fee', 'total_pool', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    console.error('Error en GET /player/my-predictions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener tus predicciones'
    });
  }
});

module.exports = router;