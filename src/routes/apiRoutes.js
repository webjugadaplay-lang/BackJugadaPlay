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


// ===== ROOM BY ID (SOLO UNA VEZ, CORRECTO) =====
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
      attributes: ['id', 'score_home', 'score_away']
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

// ===== PREDICTION =====
router.post('/player/prediction', async (req, res) => {
  try {
    const userId = req.user.id;
    const { room_id, score_home, score_away } = req.body;

    if (!room_id) {
      return res.status(400).json({ success: false });
    }

    const room = await Room.findByPk(room_id);

    if (!room) {
      return res.status(404).json({ success: false });
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
    res.status(500).json({ success: false });
  }
});

module.exports = router;