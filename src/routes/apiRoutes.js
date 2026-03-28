const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const apiSportsService = require('../services/apiSportsService');

// Importar modelos
const Continent = require('../models/Continent');
const Country = require('../models/Country');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');

// Todas las rutas requieren autenticación
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

    // Mapeo de torneos por continente basado en el nombre del continente
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

// Obtener equipos internacionales (selecciones nacionales)
router.get('/teams/international', async (req, res) => {
  try {
    console.log("Fetching international teams...");
    const teams = await Team.findAll({
      where: {
        tournament_id: null,
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    console.log(`Found ${teams.length} international teams`);
    console.log("First 10:", teams.slice(0, 10).map(t => t.name));
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

// Obtener torneos internacionales
router.get('/tournaments/international', async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({
      where: {
        country_id: null,  // Torneos sin país asociado (internacionales)
      },
      order: [['name', 'ASC']],
    });
    res.json({
      success: true,
      data: tournaments
    });
  } catch (error) {
    console.error('Error en /tournaments/international:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener torneos internacionales'
    });
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

module.exports = router;