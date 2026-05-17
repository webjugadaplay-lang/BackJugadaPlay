// controllers/adminController.js
const Room = require('../models/Room');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const FootballMatch = require('../models/FootballMatch');
const apiFootballService = require('../services/apiFootballService');
const { Op } = require('sequelize');

// ============ FUNCIÓN AUXILIAR (definida PRIMERO) ============
async function calculateLiveRanking(roomId, realHome, realAway) {
  const predictions = await Prediction.findAll({
    where: { room_id: roomId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'player_nickname']
    }]
  });

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

  ranking.sort((a, b) => a.total_error - b.total_error);

  return ranking.map((item, idx) => ({
    ...item,
    position: idx + 1
  }));
}

// ============ FUNCIONES EXPORTADAS ============
exports.getLiveMatches = async (req, res) => {
  try {
    const matches = await Room.findAll({
      where: { status: "active" },
      order: [["match_date", "ASC"]],
    });

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

    return res.json({ success: true, data: matchesWithBar });
  } catch (error) {
    console.error("Error al obtener partidos activos:", error);
    return res.status(500).json({ success: false, message: "Error al obtener partidos activos" });
  }
};

exports.updateLiveScore = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { current_score_home, current_score_away } = req.body;

    if (current_score_home === undefined || current_score_away === undefined ||
      current_score_home < 0 || current_score_away < 0) {
      return res.status(400).json({ success: false, message: "Marcador inválido" });
    }

    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Partido no encontrado" });
    }

    room.current_score_home = Number(current_score_home);
    room.current_score_away = Number(current_score_away);
    await room.save();

    const ranking = await calculateLiveRanking(roomId, current_score_home, current_score_away);
    await room.update({ live_ranking: ranking });

    return res.json({
      success: true,
      message: "Marcador actualizado y ranking recalculado",
      data: { room, ranking }
    });
  } catch (error) {
    console.error("Error al actualizar marcador:", error);
    return res.status(500).json({ success: false, message: "Error al actualizar marcador" });
  }
};

exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "active", "finished", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Estado inválido" });
    }

    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Partido no encontrado" });
    }

    room.status = status;
    await room.save();

    return res.json({ success: true, message: "Estado actualizado correctamente", data: room });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    return res.status(500).json({ success: false, message: "Error al actualizar estado" });
  }
};

exports.calculateWinners = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Sala no encontrada' });
    }

    if (room.status !== 'finished') {
      return res.status(400).json({ success: false, message: 'El partido aún no ha finalizado' });
    }

    const realHome = room.current_score_home || 0;
    const realAway = room.current_score_away || 0;

    // Obtener todas las predicciones
    const predictions = await Prediction.findAll({
      where: { room_id: roomId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'player_nickname']
      }]
    });

    // Calcular error total para cada predicción
    const predictionsWithError = predictions.map(pred => {
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
    predictionsWithError.sort((a, b) => a.total_error - b.total_error);

    // Verificar si hay algún ganador con error 0
    const minError = predictionsWithError[0]?.total_error;
    const hasWinner = minError === 0;

    if (!hasWinner) {
      // Nadie acertó el marcador exacto → No hay ganadores
      await room.update({
        winners_calculated: true,
        winners_count: 0,
        winners_list: [],
        final_prize_distributed: 0,
        prize_accumulated: (room.total_pool || 0) * 0.7  // Acumular para próximo evento
      });

      return res.json({
        success: true,
        message: 'No hubo ganadores (nadie acertó el marcador exacto)',
        data: {
          winners: [],
          total_prize: 0,
          message: 'El pozo se acumula para el próximo evento'
        }
      });
    }

    // Todos los que tienen error 0 son ganadores
    const winners = predictionsWithError.filter(p => p.total_error === 0);

    const totalPrize = parseFloat(room.total_pool) * 0.7;
    const prizePerWinner = totalPrize / winners.length;

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

    return res.json({
      success: true,
      message: `${winners.length} ganador(es) encontrado(s)`,
      data: {
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
    return res.status(500).json({ success: false, message: 'Error al calcular ganadores' });
  }
};

// ============ Sincronización con API-Football ============
exports.syncFootballMatches = async (req, res) => {
  try {
    console.log('🔄 Iniciando sincronización de partidos...');

    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = nextMonth.toISOString().split('T')[0];
    const season = today.getFullYear();

    // Ligas: Brasileirão (71), Série B (72), Argentina (128), Libertadores (13), Sudamericana (11)
    const leaguesToSync = [71, 72, 128, 13, 11];

    let newMatches = 0;
    let updatedMatches = 0;

    for (const leagueId of leaguesToSync) {
      console.log(`📡 Buscando partidos de liga ${leagueId}...`);

      const fixtures = await apiFootballService.getFixtures(leagueId, season, dateFrom, dateTo);

      for (const fixture of fixtures) {
        const existingMatch = await FootballMatch.findByPk(fixture.fixture.id);

        const matchData = {
          id: fixture.fixture.id,
          league_id: fixture.league.id,
          league_name: fixture.league.name,
          league_country: fixture.league.country,
          season: fixture.league.season,
          home_team_id: fixture.teams.home.id,
          home_team_name: fixture.teams.home.name,
          home_team_logo: fixture.teams.home.logo,
          away_team_id: fixture.teams.away.id,
          away_team_name: fixture.teams.away.name,
          away_team_logo: fixture.teams.away.logo,
          match_date: fixture.fixture.date,
          status: fixture.fixture.status.short,
          status_long: fixture.fixture.status.long,
          goals_home: fixture.goals.home,
          goals_away: fixture.goals.away
        };

        if (!existingMatch) {
          await FootballMatch.create(matchData);
          newMatches++;
        } else {
          // Solo actualizar si hay cambios importantes
          const needsUpdate =
            existingMatch.match_date !== matchData.match_date ||
            existingMatch.status !== matchData.status ||
            existingMatch.goals_home !== matchData.goals_home ||
            existingMatch.goals_away !== matchData.goals_away;

          if (needsUpdate) {
            await existingMatch.update({
              match_date: matchData.match_date,
              status: matchData.status,
              status_long: matchData.status_long,
              goals_home: matchData.goals_home,
              goals_away: matchData.goals_away
            });
            updatedMatches++;
          }
        }
      }
    }

    console.log(`✅ Sincronización: ${newMatches} nuevos, ${updatedMatches} actualizados`);

    res.json({
      success: true,
      message: 'Partidos sincronizados correctamente',
      stats: {
        newMatches,
        updatedMatches,
        totalProcessed: newMatches + updatedMatches
      }
    });

  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar partidos',
      error: error.message
    });
  }
};