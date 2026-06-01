const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Prediction = sequelize.define('Prediction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  room_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  goals_home: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  goals_away: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  halftime_home: {
    type: DataTypes.INTEGER,
  },
  halftime_away: {
    type: DataTypes.INTEGER,
  },
  points_goals: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  points_exact: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  payment_id: {
    type: DataTypes.STRING,
  }
}, {
  timestamps: true,
  tableName: 'predictions',
});

// En tu archivo de asociaciones (generalmente associations/index.js o similar)
Prediction.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
Room.hasMany(Prediction, { foreignKey: 'room_id', as: 'predictions' });

module.exports = Prediction;