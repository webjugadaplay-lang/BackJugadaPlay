const axios = require('axios');

const API_URL = process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

async function getFixtures(leagueId, season, dateFrom, dateTo) {
  try {
    console.log(`📡 Buscando partidos: ${API_URL}/fixtures`);
    console.log(`🔑 API Key existe: ${!!API_KEY}`);
    
    const response = await axios.get(`${API_URL}/fixtures`, {
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
    
    console.log(`✅ Encontrados ${response.data.results} partidos`);
    return response.data.response;
  } catch (error) {
    console.error(`❌ Error en liga ${leagueId}:`, error.message);
    if (error.response) {
      console.error('Respuesta:', error.response.data);
    }
    throw error;
  }
}

module.exports = {
  getFixtures
};