const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bar_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  team_home: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  team_away: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  match_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  prediction_close_time: {
    type: DataTypes.DATE,
  },
  entry_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total_pool: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'finished', 'cancelled'),
    defaultValue: 'pending',
  },
  current_score_home: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  current_score_away: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  timestamps: true,
  tableName: 'rooms',
});

Room.associate = (models) => {
  Room.belongsTo(models.User, { foreignKey: 'bar_id' });
};

module.exports = Room;