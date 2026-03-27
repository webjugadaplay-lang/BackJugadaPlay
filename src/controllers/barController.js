// Crear nueva sala
exports.createRoom = async (req, res) => {
  try {
    const barId = req.user.id;
    const {
      name,
      sport,
      tournament,
      team_home,
      team_away,
      match_date,
      prediction_close_time,
      entry_fee,
      api_fixture_id,
      api_league_id,
      api_league_name,
      api_team_home_id,
      api_team_away_id,
    } = req.body;
    
    // Validaciones básicas
    if (!team_home || !team_away || !match_date) {
      return res.status(400).json({
        success: false,
        message: 'Los nombres de los equipos y la fecha son obligatorios',
      });
    }
    
    const room = await Room.create({
      bar_id: barId,
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
      // Campos de API (opcionales)
      api_fixture_id,
      api_league_id,
      api_league_name,
      api_team_home_id,
      api_team_away_id,
      api_status: 'NS',
      api_last_sync: new Date(),
    });
    
    res.status(201).json({
      success: true,
      data: room,
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