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
    references: {
      model: 'users',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sport: {
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
    allowNull: false,
  },
  entry_fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 5.00,
  },
  status: {
    type: DataTypes.ENUM('active', 'closed', 'finished'),
    defaultValue: 'active',
  },
  total_pool: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  api_fixture_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  api_league_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  api_league_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  api_team_home_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  api_team_away_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  api_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'NS',
  },
  api_last_sync: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'rooms',
});

Room.associate = (models) => {
  Room.belongsTo(models.User, { foreignKey: 'bar_id' });
  Room.hasMany(models.Prediction, { foreignKey: 'room_id' });
  Room.hasOne(models.MatchResult, { foreignKey: 'room_id' });
};

module.exports = Room;