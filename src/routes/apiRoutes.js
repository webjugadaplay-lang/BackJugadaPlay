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
router.get('/player/live-room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    
    console.log(`🔍 Cargando sala en vivo: ${roomId} para usuario: ${userId}`);
    
    // Obtener la sala sin incluir la relación (para evitar error de alias)
    const room = await Room.findByPk(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }
    
    // Obtener el bar manualmente
    let barData = null;
    if (room.bar_id) {
      const bar = await User.findByPk(room.bar_id, {
        attributes: ['id', 'name', 'bar_name']
      });
      if (bar) {
        barData = {
          id: bar.id,
          name: bar.name,
          bar_name: bar.bar_name
        };
      }
    }
    
    // Obtener la predicción del usuario para esta sala
    const prediction = await Prediction.findOne({
      where: {
        user_id: userId,
        room_id: roomId
      }
    });
    
    // Obtener todas las predicciones de la sala (para ranking)
    const allPredictions = await Prediction.findAll({
      where: { room_id: roomId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'player_nickname']
      }]
    });
    
    // Verificar si el usuario ya tiene predicción
    const userPrediction = prediction ? {
      score_home: prediction.score_home,
      score_away: prediction.score_away
    } : null;
    
    // Formatear ranking
    const ranking = allPredictions.map(p => ({
      userId: p.user_id,
      name: p.User?.player_nickname || p.User?.name || 'Jugador',
      prediction: `${p.score_home} x ${p.score_away}`,
      isUser: p.user_id === userId
    }));
    
    res.json({
      success: true,
      data: {
        id: room.id,
        team_home: room.team_home,
        team_away: room.team_away,
        match_date: room.match_date,
        current_score_home: room.current_score_home || 0,
        current_score_away: room.current_score_away || 0,
        status: room.status,
        entry_fee: room.entry_fee,
        total_pool: room.total_pool,
        bar: barData,
        userPrediction,
        ranking
      }
    });
  } catch (error) {
    console.error('Error en GET /player/live-room/:roomId:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar la sala en vivo'
    });
  }
});

module.exports = router;