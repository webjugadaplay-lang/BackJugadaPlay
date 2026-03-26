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
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    const firstError = Object.values(data.errors)[0];
    throw new Error(firstError);
  }
  return data;
};

// ============ FUNCIONES PARA FILTROS ============

// Obtener todos los países (con datos de continente)
const getCountries = async () => {
  try {
    // Verificar cache primero (países no cambian frecuentemente)
    const cached = await sequelize.query(
      `SELECT * FROM countries_cache WHERE last_sync > NOW() - INTERVAL '30 days'`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    if (cached.length > 0) {
      return cached;
    }
    
    // Obtener de API
    const data = await fetchAPI('/countries');
    
    const countries = data.response.map(item => ({
      name: item.name,
      code: item.code,
      flag: item.flag,
      continent: item.continent || 'Unknown',
      last_sync: new Date()
    }));
    
    // Guardar en cache
    for (const country of countries) {
      await sequelize.query(
        `INSERT INTO countries_cache (name, code, flag, continent, last_sync)
         VALUES (:name, :code, :flag, :continent, :last_sync)
         ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         flag = EXCLUDED.flag,
         continent = EXCLUDED.continent,
         last_sync = EXCLUDED.last_sync`,
        { replacements: country }
      );
    }
    
    return countries;
  } catch (error) {
    console.error('Error en getCountries:', error);
    throw error;
  }
};

// Obtener países por continente
const getCountriesByContinent = async (continent) => {
  try {
    const allCountries = await getCountries();
    
    if (continent === 'World') {
      return allCountries;
    }
    
    return allCountries.filter(c => c.continent === continent);
  } catch (error) {
    console.error('Error en getCountriesByContinent:', error);
    throw error;
  }
};

// Obtener ligas por país
const getLeaguesByCountry = async (countryName) => {
  try {
    // Verificar cache (ligas por país, 24 horas de validez)
    const cached = await sequelize.query(
      `SELECT * FROM leagues_cache 
       WHERE country = :countryName 
       AND last_sync > NOW() - INTERVAL '1 day'`,
      {
        replacements: { countryName },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    
    if (cached.length > 0) {
      return cached;
    }
    
    // Obtener de API
    const data = await fetchAPI('/leagues', { country: countryName });
    
    const leagues = data.response.map(item => ({
      id: item.league.id,
      name: item.league.name,
      type: item.league.type,
      logo: item.league.logo,
      country: item.country.name,
      last_sync: new Date()
    }));
    
    // Guardar en cache
    for (const league of leagues) {
      await sequelize.query(
        `INSERT INTO leagues_cache (id, name, type, logo, country, last_sync)
         VALUES (:id, :name, :type, :logo, :country, :last_sync)
         ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         logo = EXCLUDED.logo,
         country = EXCLUDED.country,
         last_sync = EXCLUDED.last_sync`,
        { replacements: league }
      );
    }
    
    return leagues;
  } catch (error) {
    console.error('Error en getLeaguesByCountry:', error);
    throw error;
  }
};

// Obtener ligas mundiales (para cuando se selecciona "Mundial")
const getWorldLeagues = async () => {
  try {
    // Buscar ligas internacionales (FIFA World Cup, etc.)
    const data = await fetchAPI('/leagues', { type: 'Cup' });
    
    const worldLeagues = data.response
      .filter(item => item.country.name === 'World')
      .map(item => ({
        id: item.league.id,
        name: item.league.name,
        type: item.league.type,
        logo: item.league.logo,
        country: item.country.name,
        last_sync: new Date()
      }));
    
    return worldLeagues;
  } catch (error) {
    console.error('Error en getWorldLeagues:', error);
    throw error;
  }
};

// ============ FUNCIONES PARA EQUIPOS ============

// Buscar equipos por nombre (con filtro opcional de liga)
const searchTeams = async (searchTerm, leagueId = null) => {
  try {
    // Buscar en cache local (resultados de búsqueda)
    const cachedTeams = await sequelize.query(
      `SELECT * FROM teams_cache 
       WHERE name ILIKE :searchTerm 
       AND last_sync > NOW() - INTERVAL '7 days'
       LIMIT 20`,
      {
        replacements: { searchTerm: `%${searchTerm}%` },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (cachedTeams.length > 0) {
      return cachedTeams;
    }

    // Buscar en API
    const params = { search: searchTerm };
    if (leagueId) {
      params.league = leagueId;
      params.season = new Date().getFullYear();
    }
    
    const data = await fetchAPI('/teams', params);

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

// Buscar equipos por liga (para mostrar equipos de un campeonato)
const getTeamsByLeague = async (leagueId, season = null) => {
  try {
    const currentSeason = season || new Date().getFullYear();
    
    const data = await fetchAPI('/teams', { 
      league: leagueId, 
      season: currentSeason 
    });

    return data.response.map(item => ({
      api_team_id: item.team.id,
      name: item.team.name,
      code: item.team.code,
      logo_url: item.team.logo,
      country: item.team.country
    }));
  } catch (error) {
    console.error('Error en getTeamsByLeague:', error);
    throw error;
  }
};

// ============ FUNCIONES PARA PARTIDOS ============

// Buscar próximos partidos de un equipo
const getTeamFixtures = async (teamId, next = 10) => {
  try {
    // Buscar en cache primero (fixtures de las próximas 24h)
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
      status: item.fixture.status.short,
      venue: item.fixture.venue?.name,
      city: item.fixture.venue?.city
    };
  } catch (error) {
    console.error('Error en getFixtureById:', error);
    throw error;
  }
};

// Obtener goles de un partido (solo goles)
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

// Obtener estadísticas de un partido (para mostrar en vivo)
const getFixtureStatistics = async (fixtureId) => {
  try {
    const data = await fetchAPI('/fixtures/statistics', { fixture: fixtureId });

    return data.response.map(item => ({
      team: item.team.name,
      statistics: item.statistics
    }));
  } catch (error) {
    console.error('Error en getFixtureStatistics:', error);
    throw error;
  }
};

// ============ EXPORTACIÓN ============

module.exports = {
  // Funciones para filtros
  getCountries,
  getCountriesByContinent,
  getLeaguesByCountry,
  getWorldLeagues,
  
  // Funciones para equipos
  searchTeams,
  getTeamsByLeague,
  
  // Funciones para partidos
  getTeamFixtures,
  getFixtureById,
  getFixtureGoals,
  getFixtureStatistics
};