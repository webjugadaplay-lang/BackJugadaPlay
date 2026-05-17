const axios = require('axios');

const API_URL = process.env.API_FOOTBALL_URL;
const API_KEY = process.env.API_FOOTBALL_KEY;

async function getFixturesByLeague(leagueId, season, dateFrom, dateTo) {
  try {
    console.log(`📡 Buscando fixtures para liga ${leagueId}, temporada ${season}, desde ${dateFrom} hasta ${dateTo}`);
    
    const response = await axios({
      method: 'GET',
      url: `${API_URL}/fixtures`,
      params: {
        league: leagueId,
        season: season,
        from: dateFrom,
        to: dateTo
      },
      headers: {
        'x-apisports-key': API_KEY
      }
    });
    
    console.log(`✅ Encontrados ${response.data.results} fixtures`);
    return response.data.response;
  } catch (error) {
    console.error(`❌ Error obteniendo fixtures para liga ${leagueId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getFixturesByLeague
};