// backend/src/controllers/statsController.js
const User = require('../models/User');
const { Sequelize } = require('sequelize');

// Obtener estadísticas generales
exports.getStats = async (req, res) => {
  try {
    // Contar bares activos
    const baresCount = await User.count({
      where: { role: 'bar' }
    });

    // Contar jugadores
    const jugadoresCount = await User.count({
      where: { role: 'player' }
    });

    // Total de premios entregados (por ahora simulado, luego se calculará de predicciones)
    const totalPremios = 45230; // Temporal, luego se calculará de la tabla de premios

    // Número de deportes (por ahora fijo, luego dinámico)
    const deportesCount = 10;

    res.json({
      success: true,
      data: {
        baresActivos: baresCount,
        jugadores: jugadoresCount,
        premios: totalPremios,
        deportes: deportesCount
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};