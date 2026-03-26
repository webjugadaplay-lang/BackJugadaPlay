const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const apiSportsService = require('../services/apiSportsService');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ============ RUTAS PARA FILTROS ============

// Obtener países por continente
router.get('/countries', async (req, res) => {
  try {
    const { continent } = req.query;
    if (!continent) {
      return res.status(400).json({
        success: false,
        message: 'Continente requerido'
      });
    }

    const countries = await apiSportsService.getCountriesByContinent(continent);
    res.json({
      success: true,
      data: countries
    });
  } catch (error) {
    console.error('Error en /countries:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener países'
    });
  }
});

// Obtener ligas por país
router.get('/leagues', async (req, res) => {
  try {
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({
        success: false,
        message: 'País requerido'
      });
    }

    const leagues = await apiSportsService.getLeaguesByCountry(country);
    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    console.error('Error en /leagues:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ligas'
    });
  }
});

// Obtener ligas mundiales (para Mundial)
router.get('/world-leagues', async (req, res) => {
  try {
    const leagues = await apiSportsService.getWorldLeagues();
    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    console.error('Error en /world-leagues:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ligas mundiales'
    });
  }
});

// ============ RUTAS PARA EQUIPOS ============

// Buscar equipos por nombre (con filtro opcional de liga)
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
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error en /search-teams:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar equipos'
    });
  }
});

// Obtener equipos por liga
router.get('/teams-by-league', async (req, res) => {
  try {
    const { leagueId, season } = req.query;
    if (!leagueId) {
      return res.status(400).json({
        success: false,
        message: 'ID de liga requerido'
      });
    }

    const teams = await apiSportsService.getTeamsByLeague(parseInt(leagueId), season);
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error en /teams-by-league:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener equipos de la liga'
    });
  }
});

// ============ RUTAS PARA PARTIDOS ============

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
    res.json({
      success: true,
      data: fixtures
    });
  } catch (error) {
    console.error('Error en /team-fixtures:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar partidos'
    });
  }
});

// Obtener detalles de un fixture específico
router.get('/fixture/:id', async (req, res) => {
  try {
    const fixture = await apiSportsService.getFixtureById(req.params.id);
    if (!fixture) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }
    res.json({
      success: true,
      data: fixture
    });
  } catch (error) {
    console.error('Error en /fixture/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del partido'
    });
  }
});

// Obtener goles de un partido
router.get('/fixture/:id/goals', async (req, res) => {
  try {
    const goals = await apiSportsService.getFixtureGoals(req.params.id);
    res.json({
      success: true,
      data: goals
    });
  } catch (error) {
    console.error('Error en /fixture/:id/goals:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener goles del partido'
    });
  }
});

// Obtener estadísticas de un partido
router.get('/fixture/:id/statistics', async (req, res) => {
  try {
    const statistics = await apiSportsService.getFixtureStatistics(req.params.id);
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error en /fixture/:id/statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del partido'
    });
  }
});

module.exports = router;