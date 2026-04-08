const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Modelos
const Continent = require('../models/Continent');
const Country = require('../models/Country');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
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

// ===== CONTINENTES =====
router.get('/continents', async (req, res) => {
  try {
    const continents = await Continent.findAll({
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: continents });
  } catch (error) {
    console.error('Error en /continents:', error);
    res.status(500).json({ success: false });
  }
});

// ===== COUNTRIES =====
router.get('/countries', async (req, res) => {
  try {
    const { continentId } = req.query;
    const where = {};
    if (continentId) where.continent_id = parseInt(continentId);

    const countries = await Country.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.json({ success: true, data: countries });

  } catch (error) {
    console.error('Error en /countries:', error);
    res.status(500).json({ success: false });
  }
});

// ===== TOURNAMENTS =====
router.get('/tournaments', async (req, res) => {
  try {
    const { countryId } = req.query;
    const where = {};
    if (countryId) where.country_id = parseInt(countryId);

    const tournaments = await Tournament.findAll({
      where,
      include: [{ model: Country, as: 'country' }],
      order: [['name', 'ASC']],
    });

    res.json({ success: true, data: tournaments });

  } catch (error) {
    console.error('Error en /tournaments:', error);
    res.status(500).json({ success: false });
  }
});

// ===== TEAMS =====
router.get('/teams-by-tournament', async (req, res) => {
  try {
    const { tournamentId } = req.query;

    if (!tournamentId) {
      return res.status(400).json({ success: false });
    }

    const teams = await Team.findAll({
      where: { tournament_id: parseInt(tournamentId) },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    res.json({ success: true, data: teams });

  } catch (error) {
    console.error('Error en /teams-by-tournament:', error);
    res.status(500).json({ success: false });
  }
});

// ===== ROOM BY ID =====
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    console.log("🔍 Buscando sala con ID:", roomId);

    if (!roomId || roomId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'ID de sala inválido'
      });
    }

    const room = await Room.findByPk(roomId, {
      include: [{
        model: User,
        as: 'bar',
        attributes: ['id', 'name', 'bar_name']
      }],
      attributes: [
        'id',
        'name',
        'team_home',
        'team_away',
        'match_date',
        'prediction_close_time',
        'entry_fee',
        'total_pool',
        'status',
        'room_code'
      ]
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    res.json({ success: true, data: room });

  } catch (error) {
    console.error('Error en /rooms/:roomId:', error);
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

// ===== LIVE ROOM =====
// ===== FUNCIÓN AUXILIAR PARA CALCULAR RANKING =====
async function calculateLiveRanking(roomId, realHome, realAway) {
  const predictions = await Prediction.findAll({
    where: { room_id: roomId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'player_nickname']
    }]
  });

  const ranking = predictions.map(pred => {
    const errorHome = Math.abs(pred.score_home - realHome);
    const errorAway = Math.abs(pred.score_away - realAway);
    const totalError = errorHome + errorAway;

    return {
      user_id: pred.user_id,
      user_name: pred.User?.player_nickname || pred.User?.name || 'Jugador',
      score_home: pred.score_home,
      score_away: pred.score_away,
      error_home: errorHome,
      error_away: errorAway,
      total_error: totalError
    };
  });

  ranking.sort((a, b) => a.total_error - b.total_error);

  return ranking.map((item, idx) => ({
    ...item,
    position: idx + 1
  }));
}

// ===== LIVE ROOM =====
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
      status: status
    };
  });

  ranking.sort((a, b) => a.total_error - b.total_error);

  return ranking.map((item, idx) => ({
    userId: item.user_id,
    name: item.name,
    prediction: `${item.score_home} x ${item.score_away}`,
    isUser: false,
    position: idx + 1,
    emoji: item.emoji,
    status: item.status
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
          position: r.position
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