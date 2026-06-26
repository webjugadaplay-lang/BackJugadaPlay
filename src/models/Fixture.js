// models/Fixture.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Fixture = sequelize.define('Fixture', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false
  },
  league_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  league_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  league_country: {
    type: DataTypes.STRING(100)
  },
  league_logo: {
    type: DataTypes.TEXT
  },
  season: {
    type: DataTypes.INTEGER
  },
  round: {
    type: DataTypes.STRING(100)
  },
  home_team_id: {
    type: DataTypes.INTEGER
  },
  home_team_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  home_team_logo: {
    type: DataTypes.TEXT
  },
  home_team_winner: {
    type: DataTypes.BOOLEAN,
    defaultValue: null
  },
  away_team_id: {
    type: DataTypes.INTEGER
  },
  away_team_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  away_team_logo: {
    type: DataTypes.TEXT
  },
  away_team_winner: {
    type: DataTypes.BOOLEAN,
    defaultValue: null
  },
  match_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.BIGINT
  },
  status: {
    type: DataTypes.STRING(10),
    defaultValue: 'NS'
  },
  status_long: {
    type: DataTypes.STRING(50)
  },
  elapsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  extra_time: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  goals_home: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  goals_away: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  halftime_home: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  halftime_away: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  fulltime_home: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  fulltime_away: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  extratime_home: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  extratime_away: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  penalty_home: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  penalty_away: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  venue: {
    type: DataTypes.STRING(150)
  },
  venue_city: {
    type: DataTypes.STRING(100)
  },
  referee: {
    type: DataTypes.STRING(150)
  },
  // Guardamos los eventos como JSON para tener historial completo
  events: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'fixtures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Fixture;