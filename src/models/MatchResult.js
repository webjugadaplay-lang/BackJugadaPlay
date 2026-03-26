const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MatchResult = sequelize.define('MatchResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  room_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id',
    },
  },
  score_home: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  score_away: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  winners_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_prize: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
}, {
  timestamps: true,
  tableName: 'match_results',
});

module.exports = MatchResult;