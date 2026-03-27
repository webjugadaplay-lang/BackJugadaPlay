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

// Función para verificar si una tabla existe
const tableExists = async (tableName) => {
  try {
    const result = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = :tableName
      )`,
      {
        replacements: { tableName },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return result[0].exists;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
};

// ============ FUNCIONES PARA FILTROS ============

// Obtener todos los países (con datos de continente)
const getCountries = async () => {
  try {
    // Obtener de API (no podemos obtener países directamente, así que usamos ligas)
    const data = await fetchAPI('/leagues');
    
    // Extraer países únicos de las ligas
    const countriesMap = new Map();
    for (const item of data.response) {
      const country = item.country;
      if (!countriesMap.has(country.code)) {
        countriesMap.set(country.code, {
          code: country.code,
          name: country.name,
          flag: country.flag,
          continent: country.continent || 'Unknown',
          last_sync: new Date()
        });
      }
    }
    
    const countries = Array.from(countriesMap.values());
    
    // Intentar guardar en cache si la tabla existe
    const hasCountriesCache = await tableExists('countries_cache');
    if (hasCountriesCache) {
      for (const country of countries) {
        try {
          await sequelize.query(
            `INSERT INTO countries_cache (code, name, flag, continent, last_sync)
             VALUES (:code, :name, :flag, :continent, :last_sync)
             ON CONFLICT (code) DO UPDATE SET
             name = EXCLUDED.name,
             flag = EXCLUDED.flag,
             continent = EXCLUDED.continent,
             last_sync = EXCLUDED.last_sync`,
            { replacements: country }
          );
        } catch (err) {
          // Solo loguear error, no detener el proceso
          console.error('Error guardando país en cache:', err.message);
        }
      }
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
    
    // Intentar guardar en cache si la tabla existe
    const hasLeaguesCache = await tableExists('leagues_cache');
    if (hasLeaguesCache) {
      for (const league of leagues) {
        try {
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
        } catch (err) {
          console.error('Error guardando liga en cache:', err.message);
        }
      }
    }
    
    return leagues;
  } catch (error) {
    console.error('Error en getLeaguesByCountry:', error);
    throw error;
  }
};

// Obtener ligas mundiales
const getWorldLeagues = async () => {
  try {
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
      country: item.team.country
    }));

    return teams;
  } catch (error) {
    console.error('Error en searchTeams:', error);
    throw error;
  }
};

// Obtener equipos por liga
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
      status: item.fixture.status.short
    }));

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

// Obtener estadísticas de un partido
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