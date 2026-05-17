const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FootballMatch = sequelize.define('FootballMatch', {
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
  season: {
    type: DataTypes.INTEGER
  },
  home_team_id: {
    type: DataTypes.INTEGER
  },
  home_team_name: {
    type: DataTypes.STRING(100)
  },
  home_team_logo: {
    type: DataTypes.TEXT
  },
  away_team_id: {
    type: DataTypes.INTEGER
  },
  away_team_name: {
    type: DataTypes.STRING(100)
  },
  away_team_logo: {
    type: DataTypes.TEXT
  },
  match_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'NS'
  },
  status_long: {
    type: DataTypes.STRING(50)
  },
  goals_home: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  goals_away: {
    type: DataTypes.INTEGER,
    defaultValue: null
  }
}, {
  tableName: 'football_matches',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = FootballMatch;