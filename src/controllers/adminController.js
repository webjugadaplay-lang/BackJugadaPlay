// controllers/adminController.js
const Room = require('../models/Room');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const Fixture = require('../models/Fixture');
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

// ============ Sincronización de Partidos (Fixtures) ============
exports.syncFixtures = async (req, res) => {
  try {
    console.log('🔄 Iniciando sincronización de partidos...');

    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = nextMonth.toISOString().split('T')[0];
    const season = today.getFullYear();

    // Ligas importantes: Brasileirão, Argentina, Libertadores, Sudamericana, Premier, LaLiga
    const leaguesToSync = [
      // BRASIL
      { id: 71, name: 'Brasileirão Série A' },
      { id: 72, name: 'Brasileirão Série B' },
      //{ id: 74, name: 'Copa do Brasil' },
      //{ id: 75, name: 'Campeonato Paulista' },
      //{ id: 76, name: 'Campeonato Carioca' },

      // ARGENTINA
      { id: 128, name: 'Liga Profesional Argentina' },
      //{ id: 129, name: 'Copa Argentina' },

      // COLOMBIA
      { id: 140, name: 'Liga BetPlay' },
      //{ id: 141, name: 'Copa Colombia' },

      // RESTO LATAM
      //{ id: 144, name: 'Primera División Uruguay' },
      //{ id: 150, name: 'Primera División Chile' },
      //{ id: 145, name: 'Liga 1 Perú' },
      //{ id: 149, name: 'LigaPro Ecuador' },
      //{ id: 146, name: 'Primera División Paraguay' },
      //{ id: 153, name: 'Liga MX' },

      // INTERNACIONALES
      { id: 13, name: 'Copa Libertadores' },
      { id: 11, name: 'Copa Sudamericana' },
      //{ id: 14, name: 'Recopa Sudamericana' },

      // EUROPA (opcional)
      { id: 2, name: 'UEFA Champions League' },
      //{ id: 3, name: 'UEFA Europa League' },
      { id: 39, name: 'Premier League' },
      //{ id: 140, name: 'La Liga' },
      //{ id: 135, name: 'Serie A' },
      { id: 78, name: 'Bundesliga' },
      { id: 61, name: 'Ligue 1' }
    ];

    let newMatches = 0;
    let updatedMatches = 0;

    for (const league of leaguesToSync) {
      const fixtures = await apiFootballService.getFixturesByLeague(league.id, season, dateFrom, dateTo);

      for (const fixture of fixtures) {
        const fixtureData = {
          id: fixture.fixture.id,
          league_id: fixture.league.id,
          league_name: fixture.league.name,
          league_country: fixture.league.country,
          league_logo: fixture.league.logo,
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
          elapsed: fixture.fixture.status.elapsed || 0,
          goals_home: fixture.goals.home,
          goals_away: fixture.goals.away,
          halftime_home: fixture.score?.halftime?.home,
          halftime_away: fixture.score?.halftime?.away,
          fulltime_home: fixture.score?.fulltime?.home,
          fulltime_away: fixture.score?.fulltime?.away,
          venue: fixture.fixture.venue?.name
        };

        const existingMatch = await Fixture.findByPk(fixtureData.id);

        if (!existingMatch) {
          await Fixture.create(fixtureData);
          newMatches++;
        } else {
          // Verificar si hay cambios importantes
          const needsUpdate =
            existingMatch.status !== fixtureData.status ||
            existingMatch.goals_home !== fixtureData.goals_home ||
            existingMatch.goals_away !== fixtureData.goals_away ||
            existingMatch.match_date !== fixtureData.match_date;

          if (needsUpdate) {
            await existingMatch.update(fixtureData);
            updatedMatches++;
          }
        }
      }
    }

    console.log(`✅ Partidos sincronizados: ${newMatches} nuevos, ${updatedMatches} actualizados`);

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
    console.error('❌ Error sincronizando partidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar partidos',
      error: error.message
    });
  }
};

// ============ Obtener partidos desde la base de datos ============
exports.getFixtures = async (req, res) => {
  try {
    const { leagueId, season, dateFrom, dateTo, teamName } = req.query;

    let whereClause = {};

    // Aplicar filtros
    if (leagueId) {
      whereClause.league_id = leagueId;
    }
    if (season) {
      whereClause.season = season;
    }
    if (dateFrom) {
      whereClause.match_date = { [Op.gte]: dateFrom };
    }
    if (dateTo) {
      whereClause.match_date = { [Op.lte]: dateTo };
    }
    if (teamName) {
      whereClause[Op.or] = [
        { home_team_name: { [Op.iLike]: `%${teamName}%` } },
        { away_team_name: { [Op.iLike]: `%${teamName}%` } }
      ];
    }

    const fixtures = await Fixture.findAll({
      where: whereClause,
      order: [['match_date', 'ASC']],
      limit: 100
    });

    res.json({
      success: true,
      data: fixtures
    });

  } catch (error) {
    console.error('Error obteniendo fixtures:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener partidos'
    });
  }
};