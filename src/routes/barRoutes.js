//src/routes/barRoutes.js
const express = require('express');
const router = express.Router();
const { Room, Fixture, Bar, Prediction, RoomParticipant } = require('../models');
const authMiddleware = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// Generar código único para la sala
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Crear una nueva sala a partir de un fixture existente
router.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const {
      barId,
      fixture_id,
      entry_fee,
      prediction_close_minutes = 15
    } = req.body;

    console.log('Creating room with fixture:', fixture_id);

    // Validaciones
    if (!barId || !fixture_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'barId y fixture_id son requeridos' 
      });
    }

    // Obtener el fixture
    const fixture = await Fixture.findByPk(fixture_id);
    if (!fixture) {
      return res.status(404).json({ 
        success: false, 
        message: 'Partido no encontrado' 
      });
    }

    // Verificar que el partido no haya empezado
    const matchDate = new Date(fixture.match_date);
    if (matchDate < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede crear una sala para un partido que ya comenzó' 
      });
    }

    // Verificar que el bar existe
    const bar = await Bar.findByPk(barId);
    if (!bar) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bar no encontrado' 
      });
    }

    // Calcular tiempo de cierre de predicciones
    const prediction_close_time = new Date(matchDate);
    prediction_close_time.setMinutes(matchDate.getMinutes() - prediction_close_minutes);

    // Crear la sala
    const room = await Room.create({
      bar_id: barId,
      fixture_id: fixture_id,
      code: generateRoomCode(),
      name: `${fixture.home_team_name} vs ${fixture.away_team_name}`,
      entry_fee: entry_fee || 0,
      total_pool: 0,
      max_participants: 50,
      current_participants: 0,
      status: 'active',
      prediction_close_time: prediction_close_time,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Sala creada exitosamente',
      data: {
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          fixture: {
            home_team: fixture.home_team_name,
            away_team: fixture.away_team_name,
            match_date: fixture.match_date,
            venue: fixture.venue
          },
          entry_fee: room.entry_fee,
          prediction_close_time: room.prediction_close_time
        }
      }
    });

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear la sala: ' + error.message 
    });
  }
});

// Obtener salas activas de un bar
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const { barId, status = 'active' } = req.query;
    
    if (!barId) {
      return res.status(400).json({ 
        success: false, 
        message: 'barId es requerido' 
      });
    }

    const rooms = await Room.findAll({
      where: { 
        bar_id: barId,
        status: status
      },
      include: [
        {
          model: Fixture,
          attributes: ['home_team_name', 'away_team_name', 'match_date', 'venue']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Formatear respuesta
    const formattedRooms = rooms.map(room => ({
      id: room.id,
      code: room.code,
      partido: room.name,
      fecha: room.Fixture ? room.Fixture.match_date : room.createdAt,
      jugadores: room.current_participants,
      pozo: room.total_pool,
      entry_fee: room.entry_fee,
      status: room.status
    }));

    res.json({ success: true, data: formattedRooms });

  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cargar las salas' 
    });
  }
});

// Obtener estadísticas del bar
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { barId } = req.query;
    
    if (!barId) {
      return res.status(400).json({ 
        success: false, 
        message: 'barId es requerido' 
      });
    }

    // Obtener estadísticas reales
    const activeRooms = await Room.count({
      where: { bar_id: barId, status: 'active' }
    });

    const totalRooms = await Room.count({
      where: { bar_id: barId }
    });

    // Obtener participantes únicos
    const participants = await RoomParticipant.findAll({
      where: { '$Room.bar_id$': barId },
      include: [{ model: Room, attributes: [] }],
      attributes: ['user_id'],
      group: ['user_id']
    });

    // Calcular revenue total
    const rooms = await Room.findAll({
      where: { bar_id: barId },
      attributes: ['total_pool']
    });
    
    const totalRevenue = rooms.reduce((sum, room) => sum + parseFloat(room.total_pool || 0), 0);

    // Ranking de usuarios (puedes ajustar esta consulta según tus necesidades)
    const ranking = await RoomParticipant.findAll({
      where: { '$Room.bar_id$': barId },
      include: [{ model: Room, attributes: [] }],
      attributes: ['user_id', 'total_points'],
      order: [['total_points', 'DESC']],
      limit: 5
    });

    const formattedRanking = ranking.map((p, idx) => ({
      name: `Usuario ${p.user_id.substring(0, 8)}`,
      predictions: p.total_points
    }));

    res.json({
      success: true,
      data: {
        bar: {
          id: barId,
          name: 'Nombre del Bar' // Puedes obtener esto de la tabla Bar
        },
        stats: {
          activeRooms,
          totalPlayers: participants.length,
          todayRevenue: 0, // Calcular según fecha actual
          totalRevenue,
          rating: 4.5
        },
        ranking: formattedRanking
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cargar las estadísticas' 
    });
  }
});

// Obtener detalles de una sala específica
router.get('/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await Room.findByPk(roomId, {
      include: [
        { model: Fixture },
        { 
          model: RoomParticipant,
          include: [{ model: User, attributes: ['name', 'email'] }],
          order: [['total_points', 'DESC']]
        }
      ]
    });

    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: 'Sala no encontrada' 
      });
    }

    res.json({
      success: true,
      data: {
        room,
        participants: room.RoomParticipants || [],
        fixture: room.Fixture
      }
    });

  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cargar los detalles de la sala' 
    });
  }
});

module.exports = router;