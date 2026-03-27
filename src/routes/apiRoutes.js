const Continent = require('../models/Continent');
const Country = require('../models/Country');
const Tournament = require('../models/Tournament');

// Obtener todos los continentes
router.get('/continents', async (req, res) => {
  try {
    const continents = await Continent.findAll({
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: continents });
  } catch (error) {
    console.error('Error en /continents:', error);
    res.status(500).json({ success: false, message: 'Error al obtener continentes' });
  }
});

// Obtener países por continente
router.get('/countries', async (req, res) => {
  try {
    const { continentId } = req.query;
    const where = {};
    if (continentId) where.continent_id = continentId;
    
    const countries = await Country.findAll({
      where,
      include: [{ model: Continent, as: 'continent' }],
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: countries });
  } catch (error) {
    console.error('Error en /countries:', error);
    res.status(500).json({ success: false, message: 'Error al obtener países' });
  }
});

// Obtener torneos por país
router.get('/tournaments', async (req, res) => {
  try {
    const { countryId } = req.query;
    const where = {};
    if (countryId) where.country_id = countryId;
    
    const tournaments = await Tournament.findAll({
      where,
      include: [{ model: Country, as: 'country' }],
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: tournaments });
  } catch (error) {
    console.error('Error en /tournaments:', error);
    res.status(500).json({ success: false, message: 'Error al obtener torneos' });
  }
});