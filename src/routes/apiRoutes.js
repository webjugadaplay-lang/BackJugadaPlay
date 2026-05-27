const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Modelos
const sequelize = require('../config/database');
const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const User = require('../models/User');

// ================= PUBLIC =================

// Buscar sala por código
router.get('/rooms/find-by-code', async (req, res) => {
  try {
    const { code } = req.query;
    console.log("🔍 Buscando sala con código:", code);

    if (!code || code.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Código de sala requerido (mínimo 3 caracteres)'
      });
    }

    const room = await Room.findOne({
      where: {
        room_code: code.toUpperCase(),
        status: 'active'
      },
      attributes: ['id', 'team_home', 'team_away', 'match_date', 'entry_fee', 'total_pool']
    });

    console.log("📦 Sala encontrada:", room ? room.id : "NO ENCONTRADA");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    res.json({
      success: true,
      roomId: room.id
    });

  } catch (error) {
    console.error('Error en /rooms/find-by-code:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar la sala'
    });
  }
});

// ================= PRIVATE =================
router.use(authMiddleware);

// ===== ROOM BY ID - VERSIÓN CORREGIDA =====
router.get('/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log("🔍 [FIX] Buscando sala:", roomId);

    // Primero, buscar la sala directamente en la tabla rooms
    const room = await Room.findByPk(roomId);
    
    console.log("📦 [FIX] Sala encontrada en rooms:", room ? "SI" : "NO");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // Respuesta básica con los datos que tenemos
    const responseData = {
      id: room.id,
      name: room.name || 'Partido',
      team_home: 'Local',
      team_away: 'Visitante',
      match_date: room.prediction_close_time || new Date(),
      prediction_close_time: room.prediction_close_time,
      entry_fee: room.entry_fee || 0,
      total_pool: room.total_pool || 0,
      status: room.status,
      room_code: room.code,
      bar: {
        name: 'Bar'
      }
    };

    // Si hay fixture_id, intentar obtener datos del fixture
    if (room.fixture_id) {
      try {
        const fixtureQuery = `
          SELECT home_team_name, away_team_name, match_date 
          FROM fixtures 
          WHERE id = :fixtureId
        `;
        
        const [fixture] = await sequelize.query(fixtureQuery, {
          replacements: { fixtureId: room.fixture_id },
          type: sequelize.QueryTypes.SELECT
        });
        
        if (fixture) {
          responseData.team_home = fixture.home_team_name || 'Local';
          responseData.team_away = fixture.away_team_name || 'Visitante';
          responseData.match_date = fixture.match_date || responseData.match_date;
        }
      } catch (fixtureError) {
        console.log("No se pudo obtener fixture:", fixtureError.message);
      }
    }

    console.log("✅ [FIX] Datos enviados:", responseData);

    res.json({ 
      success: true, 
      data: responseData 
    });

  } catch (error) {
    console.error('Error en GET /rooms/:roomId:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la sala',
      error: error.message
    });
  }
});

// ===== GET EXISTING PREDICTION - CORREGIDO =====
router.get('/player/prediction/:roomId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;

    console.log("🔍 Buscando predicción del usuario:", userId, "en sala:", roomId);

    if (!roomId || roomId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'ID de sala inválido'
      });
    }

    // ✅ CORREGIDO: Usar goals_home, goals_away, is_paid en lugar de score_home, score_away, paid
    const prediction = await Prediction.findOne({
      where: {
        user_id: userId,
        room_id: roomId
      },
      attributes: ['id', 'goals_home', 'goals_away', 'is_paid']
    });

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    // ✅ CORREGIDO: Mapear los nombres para mantener compatibilidad con el frontend
    return res.json({
      success: true,
      data: {
        id: prediction.id,
        score_home: prediction.goals_home,
        score_away: prediction.goals_away,
        paid: prediction.is_paid
      }
    });

  } catch (error) {
    console.error('Error en GET /player/prediction/:roomId:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la predicción'
    });
  }
});

// ===== GET ALL PLAYER PREDICTIONS - CORREGIDO =====
router.get('/player/predictions', async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("🔍 Buscando todas las predicciones del usuario:", userId);

    const predictions = await Prediction.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Room,
          as: 'room',
          attributes: [
            'id',
            'name',
            'team_home',
            'team_away',
            'match_date',
            'entry_fee',
            'total_pool',
            'status'
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // ✅ CORREGIDO: Mapear los datos para mantener compatibilidad
    const formattedPredictions = predictions.map(pred => ({
      id: pred.id,
      room_id: pred.room_id,
      score_home: pred.goals_home,
      score_away: pred.goals_away,
      paid: pred.is_paid,
      createdAt: pred.createdAt,
      updatedAt: pred.updatedAt,
      room: pred.room
    }));

    return res.json({
      success: true,
      data: formattedPredictions
    });
  } catch (error) {
    console.error('Error en GET /player/predictions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener las predicciones'
    });
  }
});

// ===== SAVE / UPDATE PREDICTION - CORREGIDO =====
router.post('/player/prediction', async (req, res) => {
  try {
    const userId = req.user.id;
    // ✅ CORREGIDO: Aceptar ambos nombres de campo para compatibilidad
    const { room_id, score_home, score_away, goals_home, goals_away } = req.body;
    
    // Usar goals_home/away si vienen, sino usar score_home/away
    const finalGoalsHome = goals_home !== undefined ? goals_home : score_home;
    const finalGoalsAway = goals_away !== undefined ? goals_away : score_away;

    if (!room_id) {
      return res.status(400).json({
        success: false,
        message: 'room_id es requerido'
      });
    }

    const room = await Room.findByPk(room_id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    let prediction = await Prediction.findOne({
      where: { user_id: userId, room_id }
    });

    if (prediction) {
      // ✅ CORREGIDO: Usar goals_home y goals_away
      await prediction.update({ 
        goals_home: finalGoalsHome, 
        goals_away: finalGoalsAway 
      });
    } else {
      // ✅ CORREGIDO: Usar goals_home, goals_away, is_paid
      prediction = await Prediction.create({
        user_id: userId,
        room_id,
        goals_home: finalGoalsHome,
        goals_away: finalGoalsAway,
        is_paid: false
      });
    }

    // ✅ CORREGIDO: Respuesta con nombres compatibles
    res.json({ 
      success: true, 
      data: {
        id: prediction.id,
        score_home: prediction.goals_home,
        score_away: prediction.goals_away,
        paid: prediction.is_paid
      }
    });

  } catch (error) {
    console.error('Error en /player/prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar la predicción'
    });
  }
});

// ===== FUNCIÓN AUXILIAR PARA CALCULAR RANKING CON EMOJIS - CORREGIDA =====
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

    // Si el usuario ya no puede acertar el ganador
    if (realWinner !== 'draw' && predWinner !== realWinner) {
      return { emoji: '🥶', status: 'Muerto' };
    }

    // Si puede acertar el ganador, evaluar por error
    if (totalError === 0) return { emoji: '🥳', status: 'Excelente' };
    if (totalError === 1) return { emoji: '😁', status: 'Bien' };
    if (totalError === 2) return { emoji: '🥲', status: 'Regular' };
    if (totalError === 3) return { emoji: '😐', status: 'Ni bien ni mal' };
    if (totalError === 4) return { emoji: '😡', status: 'Mal' };
    return { emoji: '🥶', status: 'Muerto' };
  }

  const ranking = predictions.map(pred => {
    // ✅ CORREGIDO: Usar goals_home y goals_away
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

// Obtener sala en vivo con ranking pre-calculado - CORREGIDO
router.get('/player/live-room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // Usar ranking pre-calculado si existe, sino calcularlo
    let ranking = room.live_ranking || [];

    if (ranking.length === 0) {
      ranking = await calculateLiveRanking(roomId, room.current_score_home, room.current_score_away);
    }

    // Encontrar posición del usuario
    const userPosition = ranking.findIndex(r => r.user_id === userId);

    // Obtener predicción del usuario - CORREGIDO
    const userPrediction = await Prediction.findOne({
      where: {
        user_id: userId,
        room_id: roomId
      }
    });

    const responseData = {
      success: true,
      data: {
        id: room.id,
        team_home: room.team_home,
        team_away: room.team_away,
        match_date: room.match_date,
        current_score_home: room.current_score_home,
        current_score_away: room.current_score_away,
        status: room.status,
        entry_fee: room.entry_fee,
        total_pool: room.total_pool,
        ranking: ranking.map(r => ({
          userId: r.user_id,
          name: r.user_name,
          prediction: `${r.score_home} x ${r.score_away}`,
          isUser: r.user_id === userId,
          position: r.position,
          emoji: r.emoji || '⚽',
          status: r.status || ''
        })),
        userPrediction: userPrediction ? {
          score_home: userPrediction.goals_home,
          score_away: userPrediction.goals_away
        } : null,
        userPosition: userPosition + 1,
        totalPlayers: ranking.length
      }
    };

    return res.json(responseData);

  } catch (error) {
    console.error('Error en GET /player/live-room/:roomId:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cargar la sala en vivo'
    });
  }
});

module.exports = router;