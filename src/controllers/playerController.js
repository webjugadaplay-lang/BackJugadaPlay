// controllers/playerController.js
const sequelize = require('../config/database');
const Room = require('../models/Room');
const Prediction = require('../models/Prediction');
const Fixture = require('../models/Fixture');
const User = require('../models/User');

// ✅ NUEVA FUNCIÓN: getLiveRoomData
const getLiveRoomData = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    console.log(`📡 Obteniendo datos en vivo para sala: ${roomId}`);

    // 1. Verificar que el usuario participó en esta sala
    const userPrediction = await Prediction.findOne({
      where: { room_id: roomId, user_id: userId }
    });

    if (!userPrediction) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta sala'
      });
    }

    // 2. Obtener la sala con el fixture
    const room = await Room.findByPk(roomId, {
      include: [{
        model: Fixture,
        as: 'Fixture',
        attributes: ['id', 'team_home', 'team_away', 'home_team_logo', 'away_team_logo', 'match_date', 'goals_home', 'goals_away', 'status']
      }]
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // 3. Obtener TODAS las predicciones de la sala con datos de usuario
    const allPredictions = await Prediction.findAll({
      where: { room_id: roomId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'nickname']
      }],
      order: [['created_at', 'ASC']]
    });

    console.log(`📊 Encontradas ${allPredictions.length} predicciones`);

    // 4. Calcular el ranking
    const currentHome = room.Fixture?.goals_home || 0;
    const currentAway = room.Fixture?.goals_away || 0;
    const matchStatus = room.Fixture?.status || 'scheduled';

    const calculateProximity = (predHome, predAway) => {
      const diffHome = Math.abs(predHome - currentHome);
      const diffAway = Math.abs(predAway - currentAway);
      return diffHome + diffAway;
    };

    const ranking = allPredictions.map(pred => {
      const proximityScore = calculateProximity(pred.goals_home, pred.goals_away);
      
      let status = '';
      let emoji = '⚽';
      
      if (matchStatus === 'live' || matchStatus === 'finished') {
        if (proximityScore === 0) {
          status = 'Excelente';
          emoji = '🎯';
        } else if (proximityScore <= 2) {
          status = 'Bien';
          emoji = '👍';
        } else if (proximityScore <= 4) {
          status = 'Regular';
          emoji = '👀';
        } else {
          status = 'Lejos';
          emoji = '😅';
        }
      }

      const userData = pred.user || {};
      
      return {
        userId: userData.id || pred.user_id,
        name: userData.nickname || userData.name || 'Anónimo',
        prediction: `${pred.goals_home} x ${pred.goals_away}`,
        scoreHome: pred.goals_home,
        scoreAway: pred.goals_away,
        proximityScore: proximityScore,
        isUser: pred.user_id === userId,
        status: status,
        emoji: emoji,
        entryFee: pred.entry_fee_paid
      };
    });

    ranking.sort((a, b) => a.proximityScore - b.proximityScore);
    const rankedPlayers = ranking.map((player, index) => ({
      ...player,
      position: index + 1
    }));

    // 5. Construir respuesta completa
    const responseData = {
      id: room.id,
      team_home: room.Fixture?.team_home || 'Local',
      home_team_logo: room.Fixture?.home_team_logo || '',
      team_away: room.Fixture?.team_away || 'Visitante',
      away_team_logo: room.Fixture?.away_team_logo || '',
      match_date: room.Fixture?.match_date || new Date(),
      status: room.status,
      total_pool: room.total_pool || 0,
      current_score_home: currentHome,
      current_score_away: currentAway,
      entry_fee: room.entry_fee || 0,
      bar: room.bar ? {
        id: room.bar.id,
        name: room.bar.name || room.bar.bar_name
      } : null,
      userPrediction: {
        score_home: userPrediction.goals_home,
        score_away: userPrediction.goals_away
      },
      ranking: rankedPlayers,
      matchStatus: matchStatus,
      totalPlayers: rankedPlayers.length
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error en getLiveRoomData:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los datos de la sala en vivo'
    });
  }
};

// Función existente getMatchResult
const getMatchResult = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const prediction = await Prediction.findOne({
      where: { room_id: roomId, user_id: userId }
    });

    if (!prediction) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta sala'
      });
    }

    const room = await Room.findByPk(roomId, {
      include: [{
        model: Fixture,
        as: 'Fixture',
        attributes: ['goals_home', 'goals_away']
      }]
    });

    if (!room || room.status !== 'finished') {
      return res.status(404).json({
        success: false,
        message: 'Resultado no disponible aún'
      });
    }

    const winners = await Prediction.findAll({
      where: {
        room_id: roomId,
        goals_home: room.Fixture.goals_home,
        goals_away: room.Fixture.goals_away,
        is_paid: true
      }
    });

    const winnersCount = winners.length;
    const totalPrize = winnersCount > 0 ? (room.total_pool * 0.7) / winnersCount : 0;

    res.json({
      success: true,
      data: {
        id: room.id,
        room_id: room.id,
        score_home: room.Fixture.goals_home || 0,
        score_away: room.Fixture.goals_away || 0,
        winners_count: winnersCount,
        total_prize: Math.round(totalPrize)
      }
    });

  } catch (error) {
    console.error('❌ Error en getMatchResult:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resultado del partido'
    });
  }
};

module.exports = { getMatchResult, getLiveRoomData };