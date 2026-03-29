const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const apiSportsService = require('../services/apiSportsService');
const { Op } = require('sequelize');

// Importar modelos
const Continent = require('../models/Continent');
const Country = require('../models/Country');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const User = require('../models/User');

// ============ RUTAS PÚBLICAS (NO REQUIEREN AUTENTICACIÓN) ============

// Buscar sala por código - PÚBLICA (no requiere token)
router.get('/rooms/find-by-code', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || code.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Código de sala requerido (mínimo 3 caracteres)'
      });
    }

    // Buscar sala cuyo room_code coincida exactamente con el código
    const room = await Room.findOne({
      where: {
        room_code: code.toUpperCase(),
        status: 'active'
      },
      attributes: ['id', 'name', 'team_home', 'team_away', 'match_date', 'entry_fee']
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    res.json({
      success: true,
      roomId: room.id,
      data: {
        partido: `${room.team_home} vs ${room.team_away}`,
        fecha: room.match_date,
        entrada: room.entry_fee
      }
    });
  } catch (error) {
    console.error('Error en /rooms/find-by-code:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar la sala'
    });
  }
});

// ============ RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN) ============

// Todas las rutas a partir de aquí requieren autenticación
router.use(authMiddleware);

// ============ RUTAS PARA TORNEOS (MANUALES) ============

// Obtener todos los continentes
router.get('/continents', async (req, res) => {
  try {
    const continents = await Continent.findAll({
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: continents });
  } catch (error) {
    console.error('Error en /continents:', error);
    res.status(500).json({ success: false, message: 'Error al obtener continentes' });
  }
});

// Obtener países por continente
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
    res.status(500).json({ success: false, message: 'Error al obtener países' });
  }
});

// Obtener torneos por país
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
    res.status(500).json({ success: false, message: 'Error al obtener torneos' });
  }
});

// Obtener torneos por continente (torneos internacionales)
router.get('/tournaments/by-continent', async (req, res) => {
  try {
    const { continentId } = req.query;

    let tournaments = [];

    const continentName = await Continent.findByPk(continentId);

    if (continentName) {
      if (continentName.name === 'Sudamérica') {
        tournaments = await Tournament.findAll({
          where: {
            name: ['Copa Libertadores', 'Copa Sudamericana', 'Copa América', 'Recopa Sudamericana'],
            country_id: null,
          },
          order: [['name', 'ASC']],
        });
      } else if (continentName.name === 'Europa') {
        tournaments = await Tournament.findAll({
          where: {
            name: ['UEFA Champions League', 'UEFA Europa League', 'UEFA Europa Conference League', 'Eurocopa', 'Supercopa Europea'],
            country_id: null,
          },
          order: [['name', 'ASC']],
        });
      } else if (continentName.name === 'Mundial') {
        tournaments = await Tournament.findAll({
          where: {
            name: ['Copa Mundial FIFA'],
            country_id: null,
          },
          order: [['name', 'ASC']],
        });
      } else {
        tournaments = await Tournament.findAll({
          where: { country_id: null },
          order: [['name', 'ASC']],
        });
      }
    }

    res.json({ success: true, data: tournaments });
  } catch (error) {
    console.error('Error en /tournaments/by-continent:', error);
    res.status(500).json({ success: false, message: 'Error al obtener torneos del continente' });
  }
});

// Obtener torneos internacionales
router.get('/tournaments/international', async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({
      where: { country_id: null },
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: tournaments });
  } catch (error) {
    console.error('Error en /tournaments/international:', error);
    res.status(500).json({ success: false, message: 'Error al obtener torneos internacionales' });
  }
});

// ============ RUTAS PARA EQUIPOS ============

// Obtener equipos por torneo
router.get('/teams-by-tournament', async (req, res) => {
  try {
    const { tournamentId } = req.query;
    if (!tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'ID de torneo requerido'
      });
    }

    const teams = await Team.findAll({
      where: { tournament_id: parseInt(tournamentId) },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error en /teams-by-tournament:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener equipos del torneo'
    });
  }
});

// Obtener equipos internacionales (selecciones nacionales)
router.get('/teams/international', async (req, res) => {
  try {
    const teams = await Team.findAll({
      where: { tournament_id: null },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error en /teams/international:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener equipos internacionales'
    });
  }
});

// ============ RUTAS PARA API-SPORTS (OPCIONALES) ============

// Buscar equipos por nombre
router.get('/search-teams', async (req, res) => {
  try {
    const { q, league } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de equipo muy corto (mínimo 2 caracteres)'
      });
    }

    const teams = await apiSportsService.searchTeams(q, league);
    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error en /search-teams:', error);
    if (error.message && error.message.includes('suspended')) {
      res.json({ success: true, data: [], message: 'API temporalmente no disponible' });
    } else {
      res.status(500).json({ success: false, message: 'Error al buscar equipos' });
    }
  }
});

// Buscar próximos partidos de un equipo
router.get('/team-fixtures', async (req, res) => {
  try {
    const { teamId, next = 10 } = req.query;
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'ID de equipo requerido'
      });
    }

    const fixtures = await apiSportsService.getTeamFixtures(parseInt(teamId), parseInt(next));
    res.json({ success: true, data: fixtures });
  } catch (error) {
    console.error('Error en /team-fixtures:', error);
    if (error.message && error.message.includes('suspended')) {
      res.json({ success: true, data: [], message: 'API temporalmente no disponible' });
    } else {
      res.status(500).json({ success: false, message: 'Error al buscar partidos' });
    }
  }
});

// Obtener detalles de un fixture
router.get('/fixture/:id', async (req, res) => {
  try {
    const fixture = await apiSportsService.getFixtureById(req.params.id);
    if (!fixture) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }
    res.json({ success: true, data: fixture });
  } catch (error) {
    console.error('Error en /fixture/:id:', error);
    if (error.message && error.message.includes('suspended')) {
      res.json({ success: true, data: null, message: 'API temporalmente no disponible' });
    } else {
      res.status(500).json({ success: false, message: 'Error al obtener detalles del partido' });
    }
  }
});

// Obtener goles de un partido
router.get('/fixture/:id/goals', async (req, res) => {
  try {
    const goals = await apiSportsService.getFixtureGoals(req.params.id);
    res.json({ success: true, data: goals });
  } catch (error) {
    console.error('Error en /fixture/:id/goals:', error);
    if (error.message && error.message.includes('suspended')) {
      res.json({ success: true, data: [], message: 'API temporalmente no disponible' });
    } else {
      res.status(500).json({ success: false, message: 'Error al obtener goles del partido' });
    }
  }
});

// Obtener estadísticas de un partido
router.get('/fixture/:id/statistics', async (req, res) => {
  try {
    const statistics = await apiSportsService.getFixtureStatistics(req.params.id);
    res.json({ success: true, data: statistics });
  } catch (error) {
    console.error('Error en /fixture/:id/statistics:', error);
    if (error.message && error.message.includes('suspended')) {
      res.json({ success: true, data: [], message: 'API temporalmente no disponible' });
    } else {
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas del partido' });
    }
  }
});

// Obtener todas las predicciones del jugador
router.get('/player/predictions', async (req, res) => {
  try {
    const userId = req.user.id;

    const predictions = await Prediction.findAll({
      where: { user_id: userId },
      include: [{
        model: Room,
        as: 'room',
        attributes: ['id', 'name', 'team_home', 'team_away', 'match_date', 'entry_fee', 'total_pool', 'status']
      }],
      order: [[{ model: Room, as: 'room' }, 'match_date', 'ASC']]
    });

    res.json({ success: true, data: predictions });
  } catch (error) {
    console.error('Error en /player/predictions:', error);
    res.status(500).json({ success: false, message: 'Error al obtener predicciones' });
  }
});

// Obtener resultado de un partido por sala
router.get('/player/match-result/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const result = await MatchResult.findOne({
      where: { room_id: roomId }
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en /player/match-result/:roomId:', error);
    res.status(500).json({ success: false, message: 'Error al obtener resultado' });
  }
});

// Obtener detalles de una sala por ID (público para jugadores)
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findByPk(roomId, {
      include: [{
        model: User,
        as: 'bar',
        attributes: ['id', 'name', 'bar_name']
      }],
      attributes: ['id', 'name', 'team_home', 'team_away', 'match_date', 'prediction_close_time', 'entry_fee', 'total_pool', 'status']
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Sala no encontrada' });
    }

    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Error en /rooms/:roomId:', error);
    res.status(500).json({ success: false, message: 'Error al obtener la sala' });
  }
});

// Obtener predicción del jugador para una sala específica
router.get('/player/prediction/:roomId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;

    const prediction = await Prediction.findOne({
      where: {
        user_id: userId,
        room_id: roomId
      }
    });

    res.json({ success: true, data: prediction });
  } catch (error) {
    console.error('Error en /player/prediction/:roomId:', error);
    res.status(500).json({ success: false, message: 'Error al obtener predicción' });
  }
});

// Guardar o actualizar predicción del jugador
router.post('/player/prediction', async (req, res) => {
  try {
    const userId = req.user.id;
    const { room_id, score_home, score_away } = req.body;

    // Verificar que la sala existe y está activa
    const room = await Room.findByPk(room_id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Sala no encontrada' });
    }

    if (room.status !== 'active') {
      return res.status(400).json({ success: false, message: 'La sala no está activa' });
    }

    // Verificar que la fecha de cierre no ha pasado
    if (new Date(room.prediction_close_time) < new Date()) {
      return res.status(400).json({ success: false, message: 'El tiempo para predecir ha expirado' });
    }

    // Buscar si ya existe una predicción
    const existingPrediction = await Prediction.findOne({
      where: {
        user_id: userId,
        room_id: room_id
      }
    });

    let prediction;
    if (existingPrediction) {
      // Actualizar predicción existente
      await existingPrediction.update({
        score_home,
        score_away
      });
      prediction = existingPrediction;
    } else {
      // Crear nueva predicción
      prediction = await Prediction.create({
        user_id: userId,
        room_id,
        score_home,
        score_away,
        paid: false
      });
    }

    res.json({ success: true, data: prediction, message: existingPrediction ? 'Predicción actualizada' : 'Predicción guardada' });
  } catch (error) {
    console.error('Error en /player/prediction:', error);
    res.status(500).json({ success: false, message: 'Error al guardar predicción' });
  }
});

module.exports = router;