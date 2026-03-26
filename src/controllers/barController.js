const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { Sequelize } = require('sequelize');

// Obtener estadísticas del bar
exports.getBarStats = async (req, res) => {
  try {
    const barId = req.user.id;
    
    // Obtener datos del bar
    const bar = await User.findByPk(barId);
    
    // Salas activas del bar
    const activeRooms = await Room.count({
      where: {
        bar_id: barId,
        status: 'active',
      },
    });
    
    // Total de jugadores que participaron en salas del bar
    const totalPlayers = await Prediction.count({
      include: [{
        model: Room,
        where: { bar_id: barId },
        attributes: [],
      }],
    });
    
    // Recaudación total (suma de entry_fee * predicciones pagadas)
    const totalRevenue = await Prediction.sum('room.entry_fee', {
      include: [{
        model: Room,
        where: { bar_id: barId },
        attributes: [],
      }],
      where: { paid: true },
    });
    
    // Ranking de jugadores del día
    const todayRanking = await Prediction.findAll({
      attributes: [
        'user_id',
        [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'predictions_count'],
      ],
      include: [{
        model: Room,
        where: {
          bar_id: barId,
          match_date: {
            [Sequelize.Op.gte]: Sequelize.literal("CURRENT_DATE"),
          },
        },
        attributes: [],
      }],
      group: ['user_id'],
      order: [[Sequelize.literal('predictions_count'), 'DESC']],
      limit: 5,
    });
    
    // Obtener nombres de los usuarios del ranking
    const rankingWithNames = await Promise.all(
      todayRanking.map(async (item) => {
        const user = await User.findByPk(item.user_id);
        return {
          name: user?.name || 'Usuario',
          predictions: item.dataValues.predictions_count,
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        bar: {
          name: bar.bar_name || bar.name,
          balance: 0, // Pendiente implementar sistema de saldo
        },
        stats: {
          activeRooms,
          totalPlayers,
          todayRevenue: 0, // Pendiente calcular por día
          totalRevenue: totalRevenue || 0,
          rating: 4.8, // Temporal, luego se calculará
        },
        ranking: rankingWithNames,
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
    });
  }
};

// Obtener salas del bar
exports.getBarRooms = async (req, res) => {
  try {
    const barId = req.user.id;
    const { status } = req.query; // 'active', 'closed', 'finished'
    
    const where = { bar_id: barId };
    if (status) where.status = status;
    
    const rooms = await Room.findAll({
      where,
      order: [['match_date', 'ASC']],
      include: [{
        model: Prediction,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('predictions.id')), 'predictions_count']],
      }],
    });
    
    // Formatear datos
    const formattedRooms = rooms.map(room => ({
      id: room.id,
      partido: `${room.team_home} vs ${room.team_away}`,
      fecha: room.match_date,
      jugadores: room.predictions?.length || 0,
      pozo: room.total_pool,
      status: room.status,
    }));
    
    res.json({
      success: true,
      data: formattedRooms,
    });
  } catch (error) {
    console.error('Error al obtener salas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener salas',
    });
  }
};

// Crear nueva sala (actualizado)
exports.createRoom = async (req, res) => {
  try {
    const barId = req.user.id;
    const {
      name,
      sport,
      team_home,
      team_away,
      match_date,
      prediction_close_time,
      entry_fee,
      api_fixture_id,
      api_league_id,
      api_league_name,
      api_team_home_id,
      api_team_away_id,
    } = req.body;
    
    // Validaciones
    if (!team_home || !team_away || !match_date) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos obligatorios',
      });
    }
    
    const room = await Room.create({
      bar_id: barId,
      name: name || `${team_home} vs ${team_away}`,
      sport: sport || 'Fútbol',
      team_home,
      team_away,
      match_date,
      prediction_close_time: prediction_close_time || new Date(new Date(match_date).getTime() - 15 * 60000),
      entry_fee: entry_fee || 5,
      status: 'active',
      // Campos de API
      api_fixture_id,
      api_league_id,
      api_league_name,
      api_team_home_id,
      api_team_away_id,
      api_status: 'NS',
      api_last_sync: new Date(),
    });
    
    res.status(201).json({
      success: true,
      data: room,
      message: 'Sala creada exitosamente',
    });
  } catch (error) {
    console.error('Error al crear sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear sala',
    });
  }
};

// Obtener detalles de una sala específica
exports.getRoomDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const barId = req.user.id;
    
    const room = await Room.findOne({
      where: { id, bar_id: barId },
      include: [
        {
          model: Prediction,
          include: [{
            model: User,
            attributes: ['id', 'name', 'player_nickname'],
          }],
        },
      ],
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada',
      });
    }
    
    // Formatear predicciones
    const predictions = room.Predictions?.map(p => ({
      id: p.id,
      jugador: p.User?.player_nickname || p.User?.name,
      prediccion: `${p.score_home} x ${p.score_away}`,
      pagada: p.paid,
    })) || [];
    
    res.json({
      success: true,
      data: {
        id: room.id,
        partido: `${room.team_home} vs ${room.team_away}`,
        fecha: room.match_date,
        cierre: room.prediction_close_time,
        entrada: room.entry_fee,
        pozo: room.total_pool,
        status: room.status,
        predicciones: predictions,
      },
    });
  } catch (error) {
    console.error('Error al obtener detalles de sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles de sala',
    });
  }
};

// Cerrar predicciones de una sala
exports.closePredictions = async (req, res) => {
  try {
    const { id } = req.params;
    const barId = req.user.id;
    
    const room = await Room.findOne({
      where: { id, bar_id: barId },
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada',
      });
    }
    
    await room.update({ status: 'closed' });
    
    res.json({
      success: true,
      message: 'Predicciones cerradas exitosamente',
    });
  } catch (error) {
    console.error('Error al cerrar predicciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar predicciones',
    });
  }
};