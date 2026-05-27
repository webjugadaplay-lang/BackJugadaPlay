const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

// Variables para control de frecuencia de actualización (CRÍTICO PARA RENDIMIENTO)
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 60000; // 60 segundos - Actualiza máximo 1 vez por minuto
let isUpdating = false; // Evita actualizaciones concurrentes

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
  hooks: {
    // ✅ Hook que se ejecuta ANTES de cualquier consulta SELECT
    beforeFind: async (options) => {
      try {
        const now = Date.now();
        
        // CRÍTICO: Solo actualizar si pasó el tiempo mínimo (1 minuto)
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          return; // No actualizar, es muy pronto
        }
        
        // CRÍTICO: Evitar actualizaciones concurrentes
        if (isUpdating) {
          return; // Ya hay una actualización en curso
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
            hooks: false, // CRÍTICO: Evitar loop infinito
            silent: true,  // No disparar validaciones
            logging: false // Opcional: No loggear esta consulta
          }
        );
        
        if (updatedCount > 0) {
          console.log(`🔄 [beforeFind] ${updatedCount} sala(s) actualizadas a "finished"`);
        }
        
        // Actualizar timestamp de última ejecución
        lastUpdateTime = now;
        
      } catch (error) {
        console.error('❌ Error en hook beforeFind de Room:', error);
      } finally {
        // CRÍTICO: Siempre liberar el lock
        isUpdating = false;
      }
    },
    
    // ✅ Hook para findByPk (mismo control de frecuencia)
    beforeFindByPk: async (options) => {
      try {
        const now = Date.now();
        
        // CRÍTICO: Solo actualizar si pasó el tiempo mínimo
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          return;
        }
        
        if (isUpdating) {
          return;
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
          console.log(`🔄 [beforeFindByPk] ${updatedCount} sala(s) actualizadas a "finished"`);
        }
        
        lastUpdateTime = now;
        
      } catch (error) {
        console.error('❌ Error en hook beforeFindByPk de Room:', error);
      } finally {
        isUpdating = false;
      }
    }
  }
});

// Establecer la asociación con Fixture
Room.associate = (models) => {
  Room.belongsTo(models.Bar, { foreignKey: 'bar_id' });
  Room.belongsTo(models.Fixture, { foreignKey: 'fixture_id' });
  Room.hasMany(models.Prediction, { foreignKey: 'room_id' });
  Room.hasMany(models.RoomParticipant, { foreignKey: 'room_id' });
};

module.exports = Room;