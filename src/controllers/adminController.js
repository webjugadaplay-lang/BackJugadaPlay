// controllers/adminController.js
const Room = require('../models/Room');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const Fixture = require('../models/Fixture');
const UserLeague = require('../models/UserLeague');
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

// ============ Sincronización de Partidos (lee de user_leagues) ============
exports.syncFixtures = async (req, res) => {
  try {
    console.log('🔄 Iniciando sincronización de partidos...');

    // 1. Obtener ligas activas de la base de datos
    const activeLeagues = await UserLeague.findAll({
      where: { active: true }
    });

    if (activeLeagues.length === 0) {
      return res.json({
        success: false,
        message: 'No hay ligas sincronizadas. Agrega ligas primero desde la pestaña "Gestión de Ligas".'
      });
    }

    console.log(`📋 ${activeLeagues.length} ligas activas encontradas`);

    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = nextMonth.toISOString().split('T')[0];

    let newMatches = 0;
    let updatedMatches = 0;

    // 2. Para cada liga activa, traer sus partidos
    for (const league of activeLeagues) {
      console.log(`📡 Sincronizando ${league.league_name} (ID: ${league.league_id})...`);

      // Probar con dos temporadas: 2025 y 2026
      const seasons = [2025, 2026];

      for (const season of seasons) {
        try {
          const fixtures = await apiFootballService.getFixturesByLeague(league.league_id, season, dateFrom, dateTo);

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
              const needsUpdate =
                existingMatch.status !== fixtureData.status ||
                existingMatch.goals_home !== fixtureData.goals_home ||
                existingMatch.goals_away !== fixtureData.goals_away;

              if (needsUpdate) {
                await existingMatch.update(fixtureData);
                updatedMatches++;
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error con temporada ${season} de ${league.league_name}:`, error.message);
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
        totalProcessed: newMatches + updatedMatches,
        activeLeagues: activeLeagues.length
      }
    });

  } catch (error) {
    console.error('❌ Error en syncFixtures:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar partidos',
      error: error.message
    });
  }
};

// ============ Actualizar estados de partidos vencidos ============
const updateExpiredMatches = async () => {
  try {
    const now = new Date();

    // Actualizar partidos con fecha pasada y estado NS o TBD
    const [updatedCount] = await Fixture.update(
      {
        status: 'FT',
        status_long: 'Match Finished (Auto)',
        updated_at: now
      },
      {
        where: {
          match_date: { [Op.lt]: now },
          status: { [Op.in]: ['NS', 'TBD'] }
        }
      }
    );

    if (updatedCount > 0) {
      console.log(`🔄 ${updatedCount} partidos actualizados a FT automáticamente (fecha vencida)`);
    }

    return updatedCount;
  } catch (error) {
    console.error('Error actualizando partidos vencidos:', error);
    return 0;
  }
};

// ============ Obtener partidos desde la base de datos ============
exports.getFixtures = async (req, res) => {
  try {
    // PRIMERO: Actualizar estados de partidos vencidos
    await updateExpiredMatches();

    const { leagueId, season, dateFrom, dateTo, teamName } = req.query;

    let whereClause = {};

    // Estados que NO deben mostrarse
    const excludedStatuses = [
      'FT', 'AET', 'PEN',  // Finalizados
      '1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE',  // En curso
      'PST', 'CANC', 'ABD', 'AWD', 'WO'  // Cancelados
    ];

    whereClause.status = { [Op.notIn]: excludedStatuses };

    // Aplicar filtros opcionales
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
      whereClause.match_date = { ...whereClause.match_date, [Op.lte]: dateTo };
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
      limit: 500
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

// ============ Obtener ligas para el filtro ============
exports.getLeagues = async (req, res) => {
  try {
    // ✅ Cambiar: Obtener ligas de UserLeague en lugar de Fixture
    const leagues = await UserLeague.findAll({
      where: { active: true },
      attributes: ['league_id', 'league_name', 'league_country', 'league_logo'],
      order: [['league_country', 'ASC'], ['league_name', 'ASC']],
      raw: true
    });

    console.log(`📊 ${leagues.length} ligas encontradas en UserLeague`);

    // Transformar para que coincida con el formato esperado por el frontend
    const formattedLeagues = leagues.map(league => ({
      league_id: league.league_id,
      league_name: league.league_name,
      league_country: league.league_country,
      league_logo: league.league_logo
    }));

    res.json({
      success: true,
      data: formattedLeagues
    });
  } catch (error) {
    console.error('Error al obtener ligas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ligas'
    });
  }
};

// ============ Obtener partidos en curso ============
exports.getLiveFixtures = async (req, res) => {
  try {
    // Estados que indican partido en curso
    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE'];

    const liveMatches = await Fixture.findAll({
      where: {
        status: { [Op.in]: liveStatuses }
      },
      order: [['match_date', 'ASC']]
    });

    // Actualizar también partidos vencidos (opcional)
    await updateExpiredMatches();

    res.json({
      success: true,
      data: liveMatches
    });

  } catch (error) {
    console.error('Error obteniendo partidos en curso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener partidos en curso'
    });
  }
};

// ============ Obtener ligas disponibles desde API-Football ============
exports.getAvailableLeagues = async (req, res) => {
  try {
    const leagues = await apiFootballService.getCurrentLeagues();

    // Filtrar solo ligas de interés (opcional)
    const relevantCountries = ['Brazil', 'Argentina', 'Colombia', 'Uruguay', 'Chile', 'Peru', 'Ecuador', 'Paraguay', 'Bolivia', 'Spain', 'England', 'Italy', 'Germany', 'France'];

    // Ordenar por país y nombre
    const filteredLeagues = leagues.filter(league => {
      // Incluir ligas mundiales (World)
      if (league.country.name === 'World') return true;
      // Incluir copas internacionales
      if (league.league.type === 'Cup') return true;
      // Incluir ligas normales de países relevantes
      return relevantCountries.includes(league.country.name) && league.league.type === 'League';
    });

    res.json({
      success: true,
      data: filteredLeagues.map(league => ({
        id: league.league.id,
        name: league.league.name,
        country: league.country.name,
        logo: league.league.logo,
        season: league.seasons[0]?.year || new Date().getFullYear()
      }))
    });

  } catch (error) {
    console.error('Error obteniendo ligas disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ligas disponibles'
    });
  }
};

// ============ Agregar ligas seleccionadas por el admin ============
exports.addLeagues = async (req, res) => {
  try {
    const { leagues } = req.body; // leagues es un array de objetos con id, name, country, logo

    if (!leagues || leagues.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron ligas para agregar'
      });
    }

    let added = 0;
    let skipped = 0;

    for (const league of leagues) {
      // Verificar si ya existe
      const exists = await UserLeague.findOne({
        where: { league_id: league.id }
      });

      if (!exists) {
        await UserLeague.create({
          league_id: league.id,
          league_name: league.name,
          league_country: league.country,
          league_logo: league.logo,
          active: true
        });
        added++;
        console.log(`✅ Liga agregada: ${league.name} (${league.country})`);
      } else {
        skipped++;
        console.log(`⏭️ Liga ya existente: ${league.name}`);
      }
    }

    res.json({
      success: true,
      message: `${added} ligas agregadas, ${skipped} ya existían`,
      stats: { added, skipped }
    });

  } catch (error) {
    console.error('Error agregando ligas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar ligas',
      error: error.message
    });
  }
};

// Función auxiliar para sincronizar partidos de una liga específica
const syncFixturesForLeague = async (leagueId, leagueName) => {
  try {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = nextMonth.toISOString().split('T')[0];

    const seasons = [2025, 2026];

    for (const season of seasons) {
      const fixtures = await apiFootballService.getFixturesByLeague(leagueId, season, dateFrom, dateTo);

      for (const fixture of fixtures) {
        const existingMatch = await Fixture.findByPk(fixture.fixture.id);

        if (!existingMatch) {
          await Fixture.create({
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
          });
        }
      }
    }

    console.log(`✅ Partidos iniciales sincronizados para ${leagueName}`);
  } catch (error) {
    console.error(`Error sincronizando partidos para liga ${leagueId}:`, error);
  }
};

// ============ Obtener ligas ya sincronizadas por el admin ============
exports.getUserLeagues = async (req, res) => {
  try {
    const userLeagues = await UserLeague.findAll({
      where: { active: true },
      order: [['league_country', 'ASC'], ['league_name', 'ASC']]
    });

    res.json({
      success: true,
      data: userLeagues.map(league => ({
        league_id: league.league_id,
        league_name: league.league_name,
        league_country: league.league_country,
        league_logo: league.league_logo
      }))
    });

  } catch (error) {
    console.error('Error obteniendo ligas del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ligas sincronizadas'
    });
  }
};