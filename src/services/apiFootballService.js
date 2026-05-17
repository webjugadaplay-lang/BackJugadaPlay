const axios = require('axios');

const API_URL = process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

async function getFixtures(leagueId, season, dateFrom, dateTo) {
  try {
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
    
    return response.data.response;
  } catch (error) {
    console.error(`Error fetching fixtures for league ${leagueId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getFixtures
};