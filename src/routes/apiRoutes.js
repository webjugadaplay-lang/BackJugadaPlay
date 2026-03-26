const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const apiSportsService = require('../services/apiSportsService');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Buscar equipos por nombre
router.get('/search-teams', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de equipo muy corto (mínimo 2 caracteres)'
      });
    }

    const teams = await apiSportsService.searchTeams(q);
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

module.exports = router;