// services/fixtureUpdateService.js
const axios = require('axios');
const { Op } = require('sequelize');
const Fixture = require('../models/Fixture');

class FixtureUpdateService {
  constructor() {
    this.updateInterval = null;
    this.isRunning = false;
  }

  start(intervalMinutes = 10) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    console.log(`🔄 Servicio de actualización iniciado - Intervalo: ${intervalMinutes} minutos`);
    
    // Ejecutar inmediatamente
    this.updateLiveFixtures();
    
    // Configurar intervalo
    this.updateInterval = setInterval(() => {
      this.updateLiveFixtures();
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ Servicio de actualización detenido');
    }
  }

  async updateLiveFixtures() {
    if (this.isRunning) {
      console.log('⚠️ Actualización en curso, omitiendo...');
      return;
    }

    this.isRunning = true;
    console.log(`📊 [${new Date().toISOString()}] Actualizando fixtures en vivo...`);

    try {
      // Obtener partidos en vivo de la API
      const liveResponse = await this.fetchLiveFixtures();
      
      if (liveResponse && liveResponse.response && liveResponse.response.length > 0) {
        console.log(`📊 Encontrados ${liveResponse.response.length} partidos en vivo`);
        
        for (const fixtureData of liveResponse.response) {
          await this.updateFixture(fixtureData);
        }
      }

      // También actualizar partidos programados para hoy
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const scheduledFixtures = await Fixture.findAll({
        where: {
          match_date: {
            [Op.between]: [startOfDay, endOfDay]
          },
          status: {
            [Op.in]: ['NS', 'TBD', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']
          }
        }
      });

      if (scheduledFixtures.length > 0) {
        console.log(`📅 Actualizando ${scheduledFixtures.length} partidos programados de hoy`);
        
        for (const fixture of scheduledFixtures) {
          await this.updateScheduledFixture(fixture);
        }
      }

      console.log('✅ Actualización completada');
    } catch (error) {
      console.error('❌ Error en actualización de fixtures:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  async fetchLiveFixtures() {
    try {
      const apiKey = process.env.API_FOOTBALL_KEY;
      const baseUrl = process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';
      
      const response = await axios.get(`${baseUrl}/fixtures`, {
        params: {
          live: 'all'
        },
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching live fixtures:', error.message);
      throw error;
    }
  }

  async fetchFixtureById(fixtureId) {
    try {
      const apiKey = process.env.API_FOOTBALL_KEY;
      const baseUrl = process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';
      
      const response = await axios.get(`${baseUrl}/fixtures`, {
        params: {
          id: fixtureId
        },
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching fixture ${fixtureId}:`, error.message);
      return null;
    }
  }

  async updateFixture(fixtureData) {
    try {
      const fixture = fixtureData.fixture;
      const league = fixtureData.league;
      const teams = fixtureData.teams;
      const goals = fixtureData.goals;
      const score = fixtureData.score;
      const events = fixtureData.events || [];

      // Preparar datos para actualizar
      const updateData = {
        league_id: league.id,
        league_name: league.name,
        league_country: league.country,
        league_logo: league.logo,
        season: league.season,
        round: league.round,
        home_team_id: teams.home.id,
        home_team_name: teams.home.name,
        home_team_logo: teams.home.logo,
        home_team_winner: teams.home.winner,
        away_team_id: teams.away.id,
        away_team_name: teams.away.name,
        away_team_logo: teams.away.logo,
        away_team_winner: teams.away.winner,
        match_date: new Date(fixture.date),
        timestamp: fixture.timestamp,
        status: fixture.status.short,
        status_long: fixture.status.long,
        elapsed: fixture.status.elapsed || 0,
        extra_time: fixture.status.extra || null,
        goals_home: goals.home,
        goals_away: goals.away,
        halftime_home: score.halftime.home,
        halftime_away: score.halftime.away,
        fulltime_home: score.fulltime.home,
        fulltime_away: score.fulltime.away,
        extratime_home: score.extratime.home,
        extratime_away: score.extratime.away,
        penalty_home: score.penalty.home,
        penalty_away: score.penalty.away,
        venue: fixture.venue.name,
        venue_city: fixture.venue.city,
        referee: fixture.referee,
        events: events // Guardamos los eventos completos como JSON
      };

      // Actualizar o crear el fixture
      await Fixture.upsert({
        id: fixture.id,
        ...updateData
      });

      console.log(`✅ Partido ${teams.home.name} vs ${teams.away.name} actualizado (${fixture.status.short})`);
      
      // Emitir actualización por Socket.IO si está disponible
      if (global.io) {
        global.io.emit('fixture-update', {
          fixtureId: fixture.id,
          ...updateData
        });
      }

      return true;
    } catch (error) {
      console.error(`Error actualizando fixture ${fixtureData.fixture.id}:`, error.message);
      return false;
    }
  }

  async updateScheduledFixture(fixture) {
    try {
      const fixtureData = await this.fetchFixtureById(fixture.id);
      
      if (fixtureData && fixtureData.response && fixtureData.response.length > 0) {
        await this.updateFixture(fixtureData.response[0]);
        console.log(`🔄 Partido programado ${fixture.home_team_name} vs ${fixture.away_team_name} actualizado`);
      }
    } catch (error) {
      console.error(`Error actualizando fixture programado ${fixture.id}:`, error.message);
    }
  }
}

module.exports = FixtureUpdateService;