const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserLeague = sequelize.define('UserLeague', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  league_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
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
  season_2025: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  season_2026: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'user_leagues',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = UserLeague;