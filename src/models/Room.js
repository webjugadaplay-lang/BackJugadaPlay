// models/Room.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

let lastUpdateTime = 0;
const UPDATE_INTERVAL = 60000;
let isUpdating = false;

async function updateExpiredRooms() {
  try {
    const now = Date.now();

    if (now - lastUpdateTime < UPDATE_INTERVAL) {
      return 0;
    }

    if (isUpdating) {
      return 0;
    }

    isUpdating = true;

    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

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
    comment: '70% del total recaudado - Premio para el ganador'
  },
  total_collected: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '100% del total recaudado por todas las predicciones'
  },
  bar_commission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '20% del total recaudado - Comisión del bar'
  },
  platform_commission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '10% del total recaudado - Comisión de la plataforma JugadaPlay'
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
  hooks: {
    beforeUpdate: async (room, options) => {
      if (room.changed('total_collected')) {
        const collected = parseFloat(room.total_collected);
        room.total_pool = collected * 0.7;
        room.bar_commission = collected * 0.2;
        room.platform_commission = collected * 0.1;
      }
    }
  }
});

// ✅ ASOCIACIONES CORREGIDAS
Room.associate = (models) => {
  if (models.Bar) {
    Room.belongsTo(models.Bar, { foreignKey: 'bar_id' });
  }
  if (models.Fixture) {
    Room.belongsTo(models.Fixture, { foreignKey: 'fixture_id', as: 'Fixture' });
  }
  if (models.Prediction) {
    Room.hasMany(models.Prediction, { foreignKey: 'room_id', as: 'predictions' });
  }
};

// ✅ Sobrescribir los métodos de consulta
const originalFindAll = Room.findAll.bind(Room);
const originalFindOne = Room.findOne.bind(Room);
const originalFindByPk = Room.findByPk.bind(Room);
const originalFindAndCountAll = Room.findAndCountAll.bind(Room);

Room.findAll = async function (...args) {
  await updateExpiredRooms();
  return originalFindAll(...args);
};

Room.findOne = async function (...args) {
  await updateExpiredRooms();
  return originalFindOne(...args);
};

Room.findByPk = async function (...args) {
  await updateExpiredRooms();
  return originalFindByPk(...args);
};

Room.findAndCountAll = async function (...args) {
  await updateExpiredRooms();
  return originalFindAndCountAll(...args);
};

module.exports = Room;