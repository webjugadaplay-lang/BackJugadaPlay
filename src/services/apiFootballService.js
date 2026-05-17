const axios = require('axios');

const API_URL = process.env.API_FOOTBALL_URL;
const API_KEY = process.env.API_FOOTBALL_KEY;

async function getCountries() {
  try {
    console.log('📡 Obteniendo países desde API-Football...');

    const response = await axios({
      method: 'GET',
      url: `${API_URL}/countries`,
      headers: {
        'x-apisports-key': API_KEY
      }
    });

    console.log(`✅ ${response.data.results} países obtenidos`);
    return response.data.response;
  } catch (error) {
    console.error('❌ Error obteniendo países:', error.message);
    throw error;
  }
}

module.exports = {
  getCountries
};