// /routes/league.js
const express = require('express');
const router = express.Router();
// Cambiar la importación - importar directamente los modelos
const UserLeague = require('../models/UserLeague');
const Fixture = require('../models/Fixture');
const authMiddleware = require('../middleware/authMiddleware');

// Obtener todas las ligas activas
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching leagues...');
    const leagues = await UserLeague.findAll({
      where: { active: true },
      order: [['league_name', 'ASC']]
    });
    
    console.log(`Found ${leagues.length} leagues`);
    res.json({ success: true, data: leagues });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).json({ success: false, message: 'Error al cargar las ligas' });
  }
});

// Obtener temporadas disponibles para una liga
router.get('/:leagueId/seasons', authMiddleware, async (req, res) => {
  try {
    const { leagueId } = req.params;
    console.log(`Fetching seasons for league ${leagueId}`);
    
    const league = await UserLeague.findOne({
      where: { league_id: leagueId }
    });
    
    if (!league) {
      return res.status(404).json({ success: false, message: 'Liga no encontrada' });
    }
    
    const seasons = [];
    if (league.season_2025) seasons.push({ value: 2025, label: '2025' });
    if (league.season_2026) seasons.push({ value: 2026, label: '2026' });
    
    console.log(`Found ${seasons.length} seasons`);
    res.json({ success: true, data: seasons });
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({ success: false, message: 'Error al cargar las temporadas' });
  }
});

// Obtener fixtures (partidos) de una liga y temporada específica
router.get('/fixtures', authMiddleware, async (req, res) => {
  try {
    const { leagueId, season, status = 'NS' } = req.query;
    console.log(`Fetching fixtures for league ${leagueId}, season ${season}`);
    
    if (!leagueId || !season) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros: leagueId y season son requeridos' });
    }
    
    const whereClause = {
      league_id: parseInt(leagueId),
      season: parseInt(season),
      status: 'NS'
    };
    
    const fixtures = await Fixture.findAll({
      where: whereClause,
      order: [['match_date', 'ASC']]
    });
    
    console.log(`Found ${fixtures.length} fixtures`);
    res.json({ success: true, data: fixtures });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ success: false, message: 'Error al cargar los partidos' });
  }
});

module.exports = router;