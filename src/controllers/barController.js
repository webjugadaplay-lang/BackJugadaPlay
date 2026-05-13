// Crear nueva sala
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
    
    // Total de jugadores que participaron en salas del bar (simplificado)
    const totalPlayers = await Prediction.count({
      where: {},
    });
    
    // Total de predicciones pagadas (simplificado)
    const totalRevenue = 0;
    
    // Ranking de jugadores (simplificado)
    const ranking = [
      { name: 'Jugador 1', predictions: 0 },
      { name: 'Jugador 2', predictions: 0 },
      { name: 'Jugador 3', predictions: 0 },
    ];
    
    res.json({
      success: true,
      data: {
        bar: {
          name: bar.bar_name || bar.name,
          balance: 0,
        },
        stats: {
          activeRooms,
          totalPlayers,
          todayRevenue: 0,
          totalRevenue: totalRevenue || 0,
          rating: 4.8,
        },
        ranking,
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
    const { status } = req.query;
    
    const where = { bar_id: barId };
    if (status && status !== 'upcoming') {
      where.status = status;
    }
    
    const rooms = await Room.findAll({
      where,
      order: [['match_date', 'ASC']],
    });
    
    // Formatear datos
    const formattedRooms = rooms.map(room => ({
      id: room.id,
      partido: `${room.team_home} vs ${room.team_away}`,
      fecha: room.match_date,
      jugadores: 0, // Por ahora 0, luego se contará de predictions
      pozo: room.total_pool || 0,
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

// Crear nueva sala
exports.createRoom = async (req, res) => {
  try {
    const barId = req.user.id;
    const {
      name,
      sport,
      tournament,
      team_home,
      team_away,
      match_date,
      prediction_close_time,
      entry_fee,
    } = req.body;
    
    // Validaciones
    if (!team_home || !team_away || !match_date) {
      return res.status(400).json({
        success: false,
        message: 'Los nombres de los equipos y la fecha son obligatorios',
      });
    }
    
    // Crear la sala
    const room = await Room.create({
      bar_id: barId,
      name: name || `${team_home} vs ${team_away}`,
      sport: sport || 'Fútbol',
      tournament: tournament || 'Partido Amistoso',
      team_home,
      team_away,
      match_date,
      prediction_close_time: prediction_close_time || new Date(new Date(match_date).getTime() - 15 * 60000),
      entry_fee: entry_fee || 5,
      status: 'active',
      total_pool: 0,
    });
    
    // Generar código de sala (primeros 6 caracteres del ID)
    const roomCode = room.id.substring(0, 6).toUpperCase();
    await room.update({ room_code: roomCode });
    
    res.status(201).json({
      success: true,
      data: room,
      room_code: roomCode,
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
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada',
      });
    }
    
    res.json({
      success: true,
      data: {
        id: room.id,
        room_code: room.room_code,
        partido: `${room.team_home} vs ${room.team_away}`,
        fecha: room.match_date,
        cierre: room.prediction_close_time,
        entrada: room.entry_fee,
        pozo: room.total_pool,
        status: room.status,
        predicciones: [],
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

// En tu controlador de bars (ej: barController.js o similar)
exports.getOwnerBars = async (req, res) => {
  try {
    const userId = req.user.id; // Asumiendo que tienes middleware de autenticación
    const userRole = req.user.role;

    // Verificar que el usuario es owner
    if (userRole !== 'owner') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Solo owners pueden ver sus bares.' 
      });
    }

    // Obtener todos los bares del owner
    const bars = await Bar.findAll({
      where: { ownerId: userId },
      attributes: ['id', 'barName', 'address', 'isActive', 'balance'],
      order: [['createdAt', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      bars: bars.map(bar => ({
        id: bar.id,
        name: bar.barName,
        bar_name: bar.barName,
        address: bar.address,
        isActive: bar.isActive,
        balance: bar.balance || 0
      }))
    });

  } catch (error) {
    console.error('Error en getOwnerBars:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al cargar los bares' 
    });
  }
};