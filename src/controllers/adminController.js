// controllers/adminController.js
const Room = require('../models/Room');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { Op } = require('sequelize');

// Obtener partidos activos (status = 'active')
exports.getLiveMatches = async (req, res) => {
  try {
    console.log("🔍 getLiveMatches - Iniciando búsqueda...");

    // Obtener partidos activos sin incluir la relación (para evitar error de alias)
    const matches = await Room.findAll({
      where: {
        status: "active",
      },
      order: [["match_date", "ASC"]],
    });

    console.log(`📦 Partidos encontrados: ${matches.length}`);

    // Obtener los datos del bar para cada partido manualmente
    const matchesWithBar = [];
    for (const match of matches) {
      let barData = null;
      if (match.bar_id) {
        const bar = await User.findByPk(match.bar_id, {
          attributes: ["id", "name", "bar_name"]
        });
        if (bar) {
          barData = {
            id: bar.id,
            name: bar.name,
            bar_name: bar.bar_name
          };
        }
      }
      
      matchesWithBar.push({
        id: match.id,
        name: match.name,
        team_home: match.team_home,
        team_away: match.team_away,
        match_date: match.match_date,
        current_score_home: match.current_score_home || 0,
        current_score_away: match.current_score_away || 0,
        status: match.status,
        bar: barData,
      });
    }

    return res.json({
      success: true,
      data: matchesWithBar,
    });
  } catch (error) {
    console.error("❌ Error al obtener partidos activos:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener partidos activos",
    });
  }
};

// Actualizar marcador en vivo y recalcular ranking
exports.updateLiveScore = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { current_score_home, current_score_away } = req.body;

    if (
      current_score_home === undefined ||
      current_score_away === undefined ||
      current_score_home < 0 ||
      current_score_away < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Marcador inválido",
      });
    }

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Partido no encontrado",
      });
    }

    // Actualizar marcador
    room.current_score_home = Number(current_score_home);
    room.current_score_away = Number(current_score_away);
    await room.save();

    // Recalcular ranking en vivo
    const ranking = await calculateLiveRanking(roomId, current_score_home, current_score_away);
    
    // Guardar ranking en la sala o en tabla cache
    await room.update({ live_ranking: ranking });

    return res.json({
      success: true,
      message: "Marcador actualizado y ranking recalculado",
      data: { room, ranking },
    });
  } catch (error) {
    console.error("Error al actualizar marcador:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar marcador",
    });
  }
};

// Función para calcular ranking en vivo
async function calculateLiveRanking(roomId, realHome, realAway) {
  // Obtener todas las predicciones de la sala
  const predictions = await Prediction.findAll({
    where: { room_id: roomId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'player_nickname']
    }]
  });

  // Calcular error para cada predicción
  const ranking = predictions.map(pred => {
    const errorHome = Math.abs(pred.score_home - realHome);
    const errorAway = Math.abs(pred.score_away - realAway);
    const totalError = errorHome + errorAway;
    
    return {
      user_id: pred.user_id,
      user_name: pred.User?.player_nickname || pred.User?.name || 'Jugador',
      score_home: pred.score_home,
      score_away: pred.score_away,
      error_home: errorHome,
      error_away: errorAway,
      total_error: totalError
    };
  });

  // Ordenar por error total (menor es mejor)
  ranking.sort((a, b) => a.total_error - b.total_error);
  
  // Agregar posición
  const rankedWithPosition = ranking.map((item, idx) => ({
    ...item,
    position: idx + 1
  }));

  return rankedWithPosition;
}

// Actualizar estado de la sala
exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "active", "finished", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido",
      });
    }

    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Partido no encontrado",
      });
    }

    room.status = status;
    await room.save();

    return res.json({
      success: true,
      message: "Estado actualizado correctamente",
      data: room,
    });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar estado",
    });
  }
};

// Calcular ganadores de un partido finalizado
exports.calculateWinners = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Obtener la sala con el resultado final
    const room = await Room.findByPk(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }
    
    // Verificar que el partido esté finalizado
    if (room.status !== 'finished') {
      return res.status(400).json({
        success: false,
        message: 'El partido aún no ha finalizado'
      });
    }
    
    const realHome = room.current_score_home || 0;
    const realAway = room.current_score_away || 0;
    const realWinner = realHome > realAway ? 'home' : (realAway > realHome ? 'away' : 'draw');
    
    // Obtener todas las predicciones de la sala
    const predictions = await Prediction.findAll({
      where: { room_id: roomId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'player_nickname']
      }]
    });
    
    // FILTRO 1: Solo los que acertaron el ganador (o empate)
    let candidates = predictions.filter(pred => {
      const predWinner = pred.score_home > pred.score_away ? 'home' : 
                         (pred.score_away > pred.score_home ? 'away' : 'draw');
      return predWinner === realWinner;
    });
    
    // Si nadie acertó el ganador, no hay ganadores
    if (candidates.length === 0) {
      // Opcional: el pozo se acumula o vuelve al bar
      await room.update({ 
        winners_calculated: true,
        winners_count: 0,
        winners_list: []
      });
      
      return res.json({
        success: true,
        message: 'No hubo ganadores (nadie acertó el ganador del partido)',
        data: {
          winners: [],
          total_prize: 0,
          message: 'El pozo se acumula para el próximo evento'
        }
      });
    }
    
    // FILTRO 2: Calcular error total para cada candidato
    const candidatesWithError = candidates.map(pred => {
      const errorHome = Math.abs(pred.score_home - realHome);
      const errorAway = Math.abs(pred.score_away - realAway);
      const totalError = errorHome + errorAway;
      
      return {
        prediction_id: pred.id,
        user_id: pred.user_id,
        user_name: pred.User?.player_nickname || pred.User?.name || 'Jugador',
        score_home: pred.score_home,
        score_away: pred.score_away,
        error_home: errorHome,
        error_away: errorAway,
        total_error: totalError
      };
    });
    
    // Ordenar por error total (menor es mejor)
    candidatesWithError.sort((a, b) => a.total_error - b.total_error);
    
    // Encontrar el menor error
    const minError = candidatesWithError[0].total_error;
    
    // Todos los que tengan el menor error son ganadores
    const winners = candidatesWithError.filter(c => c.total_error === minError);
    
    // Calcular premio total (70% del pozo para los ganadores)
    const totalPrize = parseFloat(room.total_pool) * 0.7;
    const prizePerWinner = totalPrize / winners.length;
    
    // Guardar información de ganadores en la sala
    await room.update({
      winners_calculated: true,
      winners_count: winners.length,
      winners_list: winners.map(w => ({
        user_id: w.user_id,
        user_name: w.user_name,
        prediction: `${w.score_home} x ${w.score_away}`,
        prize: prizePerWinner
      })),
      final_prize_distributed: totalPrize
    });
    
    // Aquí podrías agregar lógica para distribuir los premios a las cuentas de los usuarios
    
    return res.json({
      success: true,
      message: `${winners.length} ganador(es) encontrado(s)`,
      data: {
        real_result: `${realHome} x ${realAway}`,
        real_winner: realWinner,
        winners: winners.map(w => ({
          user_id: w.user_id,
          user_name: w.user_name,
          prediction: `${w.score_home} x ${w.score_away}`,
          error: w.total_error,
          prize: prizePerWinner
        })),
        total_prize: totalPrize,
        prize_per_winner: prizePerWinner
      }
    });
    
  } catch (error) {
    console.error('Error al calcular ganadores:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al calcular ganadores'
    });
  }
};

// Al final del archivo
module.exports = {
  getLiveMatches,
  updateLiveScore,
  updateRoomStatus,
  calculateWinners,
  calculateLiveRanking  // Exportar para usar en apiRoutes
};