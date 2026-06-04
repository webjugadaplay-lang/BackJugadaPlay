const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

// Variables para control de frecuencia de actualización (CRÍTICO PARA RENDIMIENTO)
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 60000; // 60 segundos - Actualiza máximo 1 vez por minuto
let isUpdating = false; // Evita actualizaciones concurrentes

// Función para actualizar salas expiradas
async function updateExpiredRooms() {
  try {
    const now = Date.now();

    // Solo actualizar si pasó el tiempo mínimo
    if (now - lastUpdateTime < UPDATE_INTERVAL) {
      return 0;
    }

    // Evitar actualizaciones concurrentes
    if (isUpdating) {
      return 0;
    }

    isUpdating = true;

    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

    // Actualizar todas las salas activas que cumplen la condición
    const [updatedCount] = await Room.update(
      {
        status: 'finished'
      },
      {
        where: {
          status: 'active',
          prediction_close_time: {
            [Op.lte]: twoHoursAgo
          }
        },
        hooks: false,
        silent: true,
        logging: false
      }
    );

    if (updatedCount > 0) {
      console.log(`🔄 ${updatedCount} sala(s) actualizadas a "finished"`);
    }

    lastUpdateTime = now;
    return updatedCount;

  } catch (error) {
    console.error('❌ Error actualizando salas:', error);
    return 0;
  } finally {
    isUpdating = false;
  }
}

// Definir el modelo
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
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'fixtures',
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
    type: DataTypes.ENUM('active', 'closed', 'finished', 'cancelled', 'upcoming'),
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
  Room.belongsTo(models.Fixture, { foreignKey: 'fixture_id' });
  Room.hasMany(models.Prediction, { foreignKey: 'room_id' });
  Room.hasMany(models.RoomParticipant, { foreignKey: 'room_id' });
};

// ✅ Sobrescribir los métodos de consulta para actualizar automáticamente
const originalFindAll = Room.findAll.bind(Room);
const originalFindOne = Room.findOne.bind(Room);
const originalFindByPk = Room.findByPk.bind(Room);
const originalFindAndCountAll = Room.findAndCountAll.bind(Room);

// Sobrescribir findAll
Room.findAll = async function (...args) {
  await updateExpiredRooms();
  return originalFindAll(...args);
};

// Sobrescribir findOne
Room.findOne = async function (...args) {
  await updateExpiredRooms();
  return originalFindOne(...args);
};

// Sobrescribir findByPk
Room.findByPk = async function (...args) {
  await updateExpiredRooms();
  return originalFindByPk(...args);
};

// Sobrescribir findAndCountAll
Room.findAndCountAll = async function (...args) {
  await updateExpiredRooms();
  return originalFindAndCountAll(...args);
};

module.exports = Room;