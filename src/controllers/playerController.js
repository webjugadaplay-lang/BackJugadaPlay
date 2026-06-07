const db = require('../config/database');

// Obtener resultado de un partido por room_id
const getMatchResult = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verificar que el usuario tiene una predicción en esta sala
    const [predictionCheck] = await db.execute(
      'SELECT id FROM predictions WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (predictionCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta sala'
      });
    }

    // Obtener el resultado del partido
    const query = `
      SELECT 
        r.id as room_id,
        r.score_home,
        r.score_away,
        COUNT(p.id) as winners_count,
        CASE 
          WHEN COUNT(p.id) > 0 THEN r.total_pool * 0.7 / COUNT(p.id)
          ELSE 0
        END as total_prize
      FROM rooms r
      LEFT JOIN predictions p ON p.room_id = r.id 
        AND p.goals_home = r.score_home 
        AND p.goals_away = r.score_away
        AND p.is_paid = 1
      WHERE r.id = ? AND r.status = 'finished'
      GROUP BY r.id, r.score_home, r.score_away, r.total_pool
    `;

    const [result] = await db.execute(query, [roomId]);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resultado no disponible aún'
      });
    }

    const matchResult = result[0];

    res.json({
      success: true,
      data: {
        id: matchResult.room_id,
        room_id: matchResult.room_id,
        score_home: matchResult.score_home,
        score_away: matchResult.score_away,
        winners_count: matchResult.winners_count || 0,
        total_prize: Math.round(matchResult.total_prize || 0)
      }
    });

  } catch (error) {
    console.error('Error en getMatchResult:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resultado del partido'
    });
  }
};

module.exports = {
  getMatchResult
};