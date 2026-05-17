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
  match_date: {
    type: DataTypes.DATE,
    allowNull: false
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
  venue: {
    type: DataTypes.STRING(150)
  }
}, {
  tableName: 'fixtures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Fixture;