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
    const sequelize = require('../config/database');

    console.log("🔍 Buscando sala detallada:", roomId);

    const query = `
      SELECT 
        r.id,
        r.name as room_name,
        r.code as room_code,
        r.entry_fee,
        r.total_pool,
        r.status,
        r.prediction_close_time,
        r.max_participants,
        r.current_participants,
        r.createdAt as room_created_at,
        f.id as fixture_id,
        f.home_team as team_home,
        f.away_team as team_away,
        f.match_date,
        f.status as fixture_status,
        f.round as fixture_round,
        f.stadium as fixture_stadium,
        t.id as tournament_id,
        t.name as tournament_name,
        t.logo as tournament_logo,
        t.season as tournament_season,
        c.id as country_id,
        c.name as country_name,
        c.flag as country_flag,
        b.id as bar_id,
        b.name as bar_name,
        b.bar_name as bar_business_name,
        b.logo as bar_logo,
        COUNT(p.id) as total_predictions,
        SUM(CASE WHEN p.paid = true THEN 1 ELSE 0 END) as paid_predictions
      FROM rooms r
      LEFT JOIN fixtures f ON r.fixture_id = f.id
      LEFT JOIN tournaments t ON f.tournament_id = t.id
      LEFT JOIN countries c ON t.country_id = c.id
      LEFT JOIN bars b ON r.bar_id = b.id
      LEFT JOIN predictions p ON r.id = p.room_id
      WHERE r.id = :roomId
      GROUP BY 
        r.id, f.id, t.id, c.id, b.id
    `;

    const [room] = await sequelize.query(query, {
      replacements: { roomId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // Calcular premio por jugador
    const prizePerPlayer = room.total_predictions > 0
      ? Number(room.total_pool) / Number(room.total_predictions)
      : 0;

    res.json({
      success: true,
      data: {
        // Datos de la sala
        id: room.id,
        name: room.room_name,
        code: room.room_code,
        entry_fee: Number(room.entry_fee),
        total_pool: Number(room.total_pool),
        status: room.status,
        prediction_close_time: room.prediction_close_time,
        max_participants: room.max_participants,
        current_participants: room.current_participants,

        // Datos del fixture/partido
        fixture: {
          id: room.fixture_id,
          home_team: room.team_home || 'Local',
          away_team: room.team_away || 'Visitante',
          match_date: room.match_date,
          status: room.fixture_status,
          round: room.fixture_round,
          stadium: room.fixture_stadium
        },

        // Datos del torneo
        tournament: {
          id: room.tournament_id,
          name: room.tournament_name,
          logo: room.tournament_logo,
          season: room.tournament_season,
          country: {
            name: room.country_name,
            flag: room.country_flag
          }
        },

        // Datos del bar
        bar: {
          id: room.bar_id,
          name: room.bar_name,
          bar_name: room.bar_business_name,
          logo: room.bar_logo
        },

        // Estadísticas
        stats: {
          total_predictions: Number(room.total_predictions) || 0,
          paid_predictions: Number(room.paid_predictions) || 0,
          prize_per_player: prizePerPlayer,
          available_spots: Math.max(0, room.max_participants - (room.current_participants || 0))
        }
      }
    });

  } catch (error) {
    console.error('Error en GET /rooms/:roomId:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la sala'
    });
  }
});

// ===== GET EXISTING PREDICTION =====
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

    const prediction = await Prediction.findOne({
      where: {
        user_id: userId,
        room_id: roomId
      },
      attributes: ['id', 'score_home', 'score_away', 'paid']
    });

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Predicción no encontrada'
      });
    }

    return res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    console.error('Error en GET /player/prediction/:roomId:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la predicción'
    });
  }
});

// ===== GET ALL PLAYER PREDICTIONS =====
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

    return res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    console.error('Error en GET /player/predictions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener las predicciones'
    });
  }
});

// ===== SAVE / UPDATE PREDICTION =====
router.post('/player/prediction', async (req, res) => {
  try {
    const userId = req.user.id;
    const { room_id, score_home, score_away } = req.body;

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
      await prediction.update({ score_home, score_away });
    } else {
      prediction = await Prediction.create({
        user_id: userId,
        room_id,
        score_home,
        score_away,
        paid: false
      });
    }

    res.json({ success: true, data: prediction });

  } catch (error) {
    console.error('Error en /player/prediction:', error);
    res.status(500).json({
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
    const errorHome = Math.abs(pred.score_home - realHome);
    const errorAway = Math.abs(pred.score_away - realAway);
    const totalError = errorHome + errorAway;
    const { emoji, status } = getEmojiAndStatus(totalError, pred.score_home, pred.score_away, realHome, realAway);

    return {
      user_id: pred.user_id,
      user_name: pred.User?.player_nickname || pred.User?.name || 'Jugador',
      score_home: pred.score_home,
      score_away: pred.score_away,
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

// Obtener sala en vivo con ranking pre-calculado
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

    // Obtener predicción del usuario
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
          score_home: userPrediction.score_home,
          score_away: userPrediction.score_away
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

// Obtener sala en vivo con ranking pre-calculado
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

    // Obtener predicción del usuario
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
          emoji: r.emoji || '⚽',     // ← AGREGAR ESTO
          status: r.status || ''      // ← AGREGAR ESTO
        })),
        userPrediction: userPrediction ? {
          score_home: userPrediction.score_home,
          score_away: userPrediction.score_away
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