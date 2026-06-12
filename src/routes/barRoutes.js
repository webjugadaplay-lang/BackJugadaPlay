// /routes/barRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // ← IMPORTANTE: agregar esta línea
const { Sequelize } = require('sequelize');

// Importar modelos directamente
const Room = require('../models/Room');
const Fixture = require('../models/Fixture');
const Bar = require('../models/Bar');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const RoomParticipant = require('../models/RoomParticipant');
const authMiddleware = require('../middleware/authMiddleware');

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

    // Crear la sala - usando uuidv4 directamente
    const roomData = {
      id: uuidv4(),
      bar_id: barId,
      fixture_id: parseInt(fixture_id),
      code: generateRoomCode(),
      name: `${fixture.home_team_name} vs ${fixture.away_team_name}`,
      entry_fee: entry_fee || 0,
      total_pool: 0,
      max_participants: 50,
      current_participants: 0,
      status: 'active',
      prediction_close_time: prediction_close_time,
      created_by: req.user.id
    };

    console.log('Room data to create:', roomData);

    const room = await Room.create(roomData);

    res.status(201).json({
      success: true,
      message: 'Sala creada exitosamente',
      data: {
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          fixture: {
            id: fixture.id,
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
      order: [['createdAt', 'DESC']]
    });

    // Para cada sala, obtener el fixture relacionado
    const roomsWithFixture = await Promise.all(rooms.map(async (room) => {
      let fixture = null;
      if (room.fixture_id) {
        fixture = await Fixture.findByPk(room.fixture_id);
      }
      return {
        id: room.id,
        code: room.code,
        partido: room.name,
        fecha: fixture ? fixture.match_date : room.createdAt,
        jugadores: room.current_participants,
        pozo: room.total_pool,
        entry_fee: room.entry_fee,
        status: room.status
      };
    }));

    res.json({ success: true, data: roomsWithFixture });

  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar las salas: ' + error.message
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

    // Obtener estadísticas
    const activeRooms = await Room.count({
      where: { bar_id: barId, status: 'active' }
    });

    const totalRooms = await Room.count({
      where: { bar_id: barId }
    });

    // Obtener participantes únicos (sin usar include problemático)
    let totalPlayers = 0;
    try {
      const rooms = await Room.findAll({
        where: { bar_id: barId },
        attributes: ['id']
      });
      const roomIds = rooms.map(r => r.id);

      if (roomIds.length > 0) {
        const participants = await RoomParticipant.findAll({
          where: { room_id: roomIds },
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('user_id')), 'user_id']],
          raw: true
        });
        totalPlayers = participants.length;
      }
    } catch (err) {
      console.error('Error getting participants:', err);
    }

    // Calcular revenue total
    const rooms = await Room.findAll({
      where: { bar_id: barId },
      attributes: ['total_pool']
    });

    const totalRevenue = rooms.reduce((sum, room) => sum + parseFloat(room.total_pool || 0), 0);

    // Ranking simple
    const formattedRanking = [];

    // Obtener el nombre del bar
    const bar = await Bar.findByPk(barId);

    res.json({
      success: true,
      data: {
        bar: {
          id: barId,
          name: bar ? bar.barName : 'Mi Bar',
          bar_name: bar ? bar.barName : 'Mi Bar',
          balance: 0
        },
        stats: {
          activeRooms,
          totalPlayers: totalPlayers,
          todayRevenue: 0,
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
      message: 'Error al cargar las estadísticas: ' + error.message
    });
  }
});

// Obtener detalles de una sala específica
router.get('/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    console.log("yo soy de barRoutes");
    
    const fixture = room.fixture_id ? await Fixture.findByPk(room.fixture_id) : null;

    const participants = await Prediction.findAll({
      where: { room_id: roomId },
    });

    // Obtener nombres de usuarios
    const participantsWithUsers = await Promise.all(participants.map(async (p) => {
      const user = await User.findByPk(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        user_name: user ? user.name : 'Usuario',
        total_points: p.total_points,
        rank: p.rank,
        joined_at: p.joined_at
      };
    }));

    res.json({
      success: true,
      data: {
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          entry_fee: room.entry_fee,
          total_pool: room.total_pool,
          total_collected: room.total_collected,      // ← NUEVA COLUMNA
          bar_commission: room.bar_commission,        // ← NUEVA COLUMNA
          platform_commission: room.platform_commission, // ← NUEVA COLUMNA
          status: room.status,
          prediction_close_time: room.prediction_close_time,
          current_participants: room.current_participants,
          max_participants: room.max_participants
        },
        fixture: fixture ? {
          id: fixture.id,
          home_team: fixture.home_team_name,
          away_team: fixture.away_team_name,
          match_date: fixture.match_date,
          venue: fixture.venue,
          status: fixture.status
        } : null,
        participants: participantsWithUsers
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