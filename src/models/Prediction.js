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
    references: {
      model: 'rooms',
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
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
  paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
  tableName: 'predictions',
});

Prediction.associate = (models) => {
  Prediction.belongsTo(models.Room, { foreignKey: 'room_id' });
  Prediction.belongsTo(models.User, { foreignKey: 'user_id' });
};


module.exports = Prediction;