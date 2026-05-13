//src/controllers/barController.js
const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Bar = require('../models/Bar'); // 🔥 IMPORTANTE: Agregar esta línea
const { Sequelize } = require('sequelize');
const { Op } = require('sequelize');

// Obtener estadísticas del bar (ahora acepta barId por query)
exports.getBarStats = async (req, res) => {
  try {
    const { barId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let targetBarId = barId;
    
    // Si el usuario es bar (rol 'bar'), usar su ID como barId
    if (userRole === 'bar') {
      targetBarId = userId;
    }
    
    if (!targetBarId) {
      return res.status(400).json({
        success: false,
        message: 'barId es requerido para owners'
      });
    }
    
    // Verificar que el bar pertenece al owner (si es owner)
    if (userRole === 'owner') {
      const bar = await Bar.findOne({
        where: { id: targetBarId, ownerId: userId }
      });
      if (!bar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este bar'
        });
      }
    }
    
    // Obtener datos del bar
    const bar = await Bar.findByPk(targetBarId);
    if (!bar) {
      return res.status(404).json({
        success: false,
        message: 'Bar no encontrado'
      });
    }
    
    // Contar salas activas
    const activeRooms = await Room.count({
      where: {
        bar_id: targetBarId,
        status: 'active',
        match_date: { [Op.gte]: new Date() }
      },
    });
    
    // Contar jugadores únicos
    const totalPlayers = await Prediction.count({
      distinct: true,
      col: 'user_id',
      include: [{
        model: Room,
        where: { bar_id: targetBarId }
      }]
    });
    
    // Calcular recaudado hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayRevenueResult = await Prediction.sum('entry_fee', {
      include: [{
        model: Room,
        where: { bar_id: targetBarId }
      }],
      where: {
        created_at: { [Op.gte]: today, [Op.lt]: tomorrow }
      }
    });
    const todayRevenue = todayRevenueResult || 0;
    
    // Total recaudado
    const totalRevenueResult = await Prediction.sum('entry_fee', {
      include: [{
        model: Room,
        where: { bar_id: targetBarId }
      }]
    });
    const totalRevenue = totalRevenueResult || 0;
    
    // Ranking (simplificado por ahora)
    const ranking = [
      { name: 'Sin datos', predictions: 0 }
    ];
    
    res.json({
      success: true,
      data: {
        bar: {
          name: bar.barName,
          bar_name: bar.barName,
          balance: parseFloat(bar.balance) || 0,
        },
        stats: {
          activeRooms,
          totalPlayers,
          todayRevenue,
          totalRevenue,
          rating: 4.5,
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

// Obtener salas del bar (ahora acepta barId por query)
exports.getBarRooms = async (req, res) => {
  try {
    const { barId, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let targetBarId = barId;
    
    // Si el usuario es bar, usar su ID
    if (userRole === 'bar') {
      targetBarId = userId;
    }
    
    if (!targetBarId) {
      return res.status(400).json({
        success: false,
        message: 'barId es requerido para owners'
      });
    }
    
    // Verificar permisos para owner
    if (userRole === 'owner') {
      const bar = await Bar.findOne({
        where: { id: targetBarId, ownerId: userId }
      });
      if (!bar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este bar'
        });
      }
    }
    
    const where = { bar_id: targetBarId };
    const now = new Date();
    
    if (status === 'active') {
      where.match_date = { [Op.gte]: now };
      where.status = 'active';
    } else if (status === 'upcoming') {
      where.match_date = { [Op.gt]: now };
      where.status = 'pending';
    }
    
    const rooms = await Room.findAll({
      where,
      order: [['match_date', 'ASC']],
    });
    
    // Formatear datos y contar jugadores
    const formattedRooms = await Promise.all(rooms.map(async (room) => {
      const playerCount = await Prediction.count({
        distinct: true,
        col: 'user_id',
        where: { room_id: room.id }
      });
      
      return {
        id: room.id,
        partido: `${room.team_home} vs ${room.team_away}`,
        fecha: room.match_date,
        jugadores: playerCount,
        pozo: room.total_pool || 0,
        status: room.status,
      };
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

// Crear nueva sala (modificado para usar barId del body)
exports.createRoom = async (req, res) => {
  try {
    const { barId, name, sport, tournament, team_home, team_away, match_date, prediction_close_time, entry_fee } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let targetBarId = barId;
    
    // Si es bar, usar su ID
    if (userRole === 'bar') {
      targetBarId = userId;
    }
    
    if (!targetBarId) {
      return res.status(400).json({
        success: false,
        message: 'barId es requerido'
      });
    }
    
    // Verificar que el bar pertenece al owner
    if (userRole === 'owner') {
      const bar = await Bar.findOne({
        where: { id: targetBarId, ownerId: userId }
      });
      if (!bar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para crear salas en este bar'
        });
      }
    }
    
    // Validaciones
    if (!team_home || !team_away || !match_date) {
      return res.status(400).json({
        success: false,
        message: 'Los nombres de los equipos y la fecha son obligatorios',
      });
    }
    
    // Crear la sala
    const room = await Room.create({
      bar_id: targetBarId,
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
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const room = await Room.findByPk(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada',
      });
    }
    
    // Verificar permisos
    if (userRole === 'owner') {
      const bar = await Bar.findOne({
        where: { id: room.bar_id, ownerId: userId }
      });
      if (!bar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver esta sala'
        });
      }
    } else if (userRole === 'bar' && room.bar_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta sala'
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
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const room = await Room.findByPk(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada',
      });
    }
    
    // Verificar permisos
    if (userRole === 'owner') {
      const bar = await Bar.findOne({
        where: { id: room.bar_id, ownerId: userId }
      });
      if (!bar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para cerrar esta sala'
        });
      }
    } else if (userRole === 'bar' && room.bar_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cerrar esta sala'
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

// Obtener todos los bares del owner
exports.getOwnerBars = async (req, res) => {
  try {
    const userId = req.user.id;
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
        balance: parseFloat(bar.balance) || 0
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