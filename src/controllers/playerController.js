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

    // 1. Verificar acceso del usuario
    const userPrediction = await Prediction.findOne({
      where: { room_id: roomId, user_id: userId }
    });

    if (!userPrediction) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta sala'
      });
    }

    // 2. Obtener sala con fixture
    const room = await Room.findByPk(roomId, {
      include: [{
        model: Fixture,
        as: 'Fixture'
      }]
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // 3. Obtener todas las predicciones
    const allPredictions = await Prediction.findAll({
      where: { room_id: roomId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'nickname']
      }]
    });

    // 4. Datos del marcador actual
    const currentHome = room.Fixture?.goals_home || 0;
    const currentAway = room.Fixture?.goals_away || 0;
    const matchStatus = room.Fixture?.status || 'scheduled';

    // 5. Calcular ranking basado en proximidad al marcador actual
    const ranking = allPredictions.map(pred => {
      const diffHome = Math.abs(pred.goals_home - currentHome);
      const diffAway = Math.abs(pred.goals_away - currentAway);
      const proximityScore = diffHome + diffAway;

      let status = '';
      let emoji = '⚽';
      
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

      return {
        userId: pred.user?.id || pred.user_id,
        name: pred.user?.nickname || pred.user?.name || 'Anónimo',
        prediction: `${pred.goals_home} x ${pred.goals_away}`,
        isUser: pred.user_id === userId,
        emoji: emoji,
        status: status,
        proximityScore: proximityScore
      };
    });

    // Ordenar por proximidad (menor = mejor)
    ranking.sort((a, b) => a.proximityScore - b.proximityScore);
    
    // Asignar posiciones
    ranking.forEach((player, index) => {
      player.position = index + 1;
    });

    // 6. Calcular ganadores (si el partido terminó)
    let winnersCount = 0;
    let totalPrize = 0;

    if (room.status === 'finished') {
      const winners = allPredictions.filter(pred => 
        pred.goals_home === currentHome && 
        pred.goals_away === currentAway &&
        pred.is_paid === true
      );
      
      winnersCount = winners.length;
      totalPrize = winnersCount > 0 ? (room.total_pool * 0.7) / winnersCount : 0;
    }

    // 7. CONSTRUIR RESPUESTA ÚNICA CON TODO
    const response = {
      success: true,
      match: {
        id: room.id,
        room_id: room.id,
        match_date: room.Fixture?.match_date || new Date(),
        status: room.status,
        total_pool: room.total_pool || 0,
        current_score_home: currentHome,
        current_score_away: currentAway,
        entry_fee: room.entry_fee || 0,
        bar: room.bar ? { id: room.bar.id, name: room.bar.name } : null,
        
        // Datos de equipos
        team_home: room.Fixture?.team_home || 'Local',
        home_team_logo: room.Fixture?.home_team_logo || '',
        team_away: room.Fixture?.team_away || 'Visitante',
        away_team_logo: room.Fixture?.away_team_logo || '',
        
        // Resultado final (solo si terminó)
        score_home: currentHome,
        score_away: currentAway,
        winners_count: winnersCount,
        total_prize: Math.round(totalPrize),
        
        // Predicción del usuario
        userPrediction: {
          score_home: userPrediction.goals_home,
          score_away: userPrediction.goals_away
        },
        
        // Ranking en vivo
        ranking: ranking,
        totalPlayers: ranking.length,
        matchStatus: matchStatus
      }
    };

    console.log('📊 Enviando datos completos:');
    console.log(`   - Marcador: ${currentHome} x ${currentAway}`);
    console.log(`   - Ranking: ${ranking.length} jugadores`);
    console.log(`   - Ganadores: ${winnersCount}`);
    console.log(`   - Premio: R$ ${totalPrize}`);

    res.json(response);

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