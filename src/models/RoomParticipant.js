const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoomParticipant = sequelize.define('RoomParticipant', {
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
  total_points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rank: {
    type: DataTypes.INTEGER,
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  timestamps: true,
  tableName: 'room_participants',
});

RoomParticipant.associate = (models) => {
  RoomParticipant.belongsTo(models.Room, { foreignKey: 'room_id' });
  RoomParticipant.belongsTo(models.User, { foreignKey: 'user_id' });
};

module.exports = RoomParticipant;