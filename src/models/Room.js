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
  fixture_id: {
    type: DataTypes.BIGINT,  // ← Este campo es crucial
    allowNull: false,
    references: {
      model: 'fixtures',  // Referencia a la tabla fixtures
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING(10),
    unique: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entry_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total_pool: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  max_participants: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
  },
  current_participants: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('active', 'closed', 'finished', 'cancelled'),
    defaultValue: 'active',
  },
  prediction_close_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
  }
}, {
  timestamps: true,
  tableName: 'rooms',
});

// Establecer la asociación con Fixture
Room.associate = (models) => {
  Room.belongsTo(models.Bar, { foreignKey: 'bar_id' });
  Room.belongsTo(models.Fixture, { foreignKey: 'fixture_id' });  // ← Relación con Fixture
  Room.hasMany(models.Prediction, { foreignKey: 'room_id' });
  Room.hasMany(models.RoomParticipant, { foreignKey: 'room_id' });
};

module.exports = Room;