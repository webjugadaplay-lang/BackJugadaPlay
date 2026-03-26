const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_SPORTS_KEY;

// Helper para peticiones fetch
const fetchAPI = async (endpoint, params = {}) => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  
  const response = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  });
  
  const data = await response.json();
  if (data.errors?.length) {
    throw new Error(data.errors[0]);
  }
  return data;
};

// Buscar equipos por nombre
const searchTeams = async (searchTerm) => {
  try {
    // Primero buscar en cache local
    const cachedTeams = await sequelize.query(
      `SELECT * FROM teams_cache WHERE name ILIKE :searchTerm LIMIT 10`,
      {
        replacements: { searchTerm: `%${searchTerm}%` },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (cachedTeams.length > 0 && cachedTeams[0].last_sync > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      return cachedTeams;
    }

    // Buscar en API con fetch
    const data = await fetchAPI('/teams', { search: searchTerm });

    const teams = data.response.map(item => ({
      api_team_id: item.team.id,
      name: item.team.name,
      code: item.team.code,
      logo_url: item.team.logo,
      country: item.team.country,
      last_sync: new Date()
    }));

    // Guardar en cache
    for (const team of teams) {
      await sequelize.query(
        `INSERT INTO teams_cache (api_team_id, name, code, logo_url, country, last_sync)
         VALUES (:api_team_id, :name, :code, :logo_url, :country, :last_sync)
         ON CONFLICT (api_team_id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         logo_url = EXCLUDED.logo_url,
         country = EXCLUDED.country,
         last_sync = EXCLUDED.last_sync`,
        { replacements: team }
      );
    }

    return teams;
  } catch (error) {
    console.error('Error en searchTeams:', error);
    throw error;
  }
};

// Buscar próximos partidos de un equipo
const getTeamFixtures = async (teamId, next = 10) => {
  try {
    // Buscar en cache primero
    const cachedFixtures = await sequelize.query(
      `SELECT * FROM fixtures_cache 
       WHERE (team_home_id = :teamId OR team_away_id = :teamId)
       AND match_date > NOW()
       ORDER BY match_date ASC 
       LIMIT :next`,
      {
        replacements: { teamId, next },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (cachedFixtures.length > 0 && cachedFixtures[0].last_sync > new Date(Date.now() - 6 * 60 * 60 * 1000)) {
      return cachedFixtures;
    }

    // Buscar en API
    const data = await fetchAPI('/fixtures', {
      team: teamId,
      next,
      season: new Date().getFullYear()
    });

    const fixtures = data.response.map(item => ({
      api_fixture_id: item.fixture.id,
      api_league_id: item.league.id,
      league_name: item.league.name,
      season: item.league.season,
      team_home_id: item.teams.home.id,
      team_home_name: item.teams.home.name,
      team_away_id: item.teams.away.id,
      team_away_name: item.teams.away.name,
      match_date: item.fixture.date,
      status: item.fixture.status.short,
      last_sync: new Date()
    }));

    // Guardar en cache
    for (const fixture of fixtures) {
      await sequelize.query(
        `INSERT INTO fixtures_cache (api_fixture_id, api_league_id, league_name, season,
          team_home_id, team_home_name, team_away_id, team_away_name, match_date, status, last_sync)
         VALUES (:api_fixture_id, :api_league_id, :league_name, :season,
          :team_home_id, :team_home_name, :team_away_id, :team_away_name, :match_date, :status, :last_sync)
         ON CONFLICT (api_fixture_id) DO UPDATE SET
          match_date = EXCLUDED.match_date,
          status = EXCLUDED.status,
          last_sync = EXCLUDED.last_sync`,
        { replacements: fixture }
      );
    }

    return fixtures;
  } catch (error) {
    console.error('Error en getTeamFixtures:', error);
    throw error;
  }
};

// Obtener detalles de un fixture específico
const getFixtureById = async (fixtureId) => {
  try {
    const data = await fetchAPI('/fixtures', { id: fixtureId });

    const item = data.response[0];
    if (!item) return null;

    return {
      api_fixture_id: item.fixture.id,
      api_league_id: item.league.id,
      league_name: item.league.name,
      season: item.league.season,
      team_home_id: item.teams.home.id,
      team_home_name: item.teams.home.name,
      team_away_id: item.teams.away.id,
      team_away_name: item.teams.away.name,
      match_date: item.fixture.date,
      status: item.fixture.status.short
    };
  } catch (error) {
    console.error('Error en getFixtureById:', error);
    throw error;
  }
};

// Obtener goles de un partido
const getFixtureGoals = async (fixtureId) => {
  try {
    const data = await fetchAPI('/fixtures/events', {
      fixture: fixtureId,
      type: 'Goal'
    });

    return data.response.map(event => ({
      minute: event.time.elapsed,
      team: event.team.name,
      player: event.player.name,
      assist: event.assist?.name || null
    }));
  } catch (error) {
    console.error('Error en getFixtureGoals:', error);
    throw error;
  }
};

// Buscar ligas por país
const getLeaguesByCountry = async (country) => {
  try {
    const data = await fetchAPI('/leagues', { country });

    return data.response.map(item => ({
      id: item.league.id,
      name: item.league.name,
      type: item.league.type,
      logo: item.league.logo,
      country: item.country.name
    }));
  } catch (error) {
    console.error('Error en getLeaguesByCountry:', error);
    throw error;
  }
};

module.exports = {
  searchTeams,
  getTeamFixtures,
  getFixtureById,
  getFixtureGoals,
  getLeaguesByCountry
};