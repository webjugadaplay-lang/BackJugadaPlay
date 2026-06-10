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
  entry_fee_paid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Monto pagado por el jugador por esta predicción'
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
  hooks: {
    afterCreate: async (prediction, options) => {
      try {
        const Room = require('./Room');
        const amountPaid = parseFloat(prediction.entry_fee_paid);
        
        // Obtener la sala actual
        const room = await Room.findByPk(prediction.room_id, {
          transaction: options.transaction
        });
        
        if (!room) {
          throw new Error(`Sala ${prediction.room_id} no encontrada`);
        }
        
        // Calcular nuevo total recaudado
        const currentCollected = parseFloat(room.total_collected || 0);
        const newTotalCollected = currentCollected + amountPaid;
        
        // Actualizar la sala con todos los campos calculados
        await Room.update({
          total_collected: newTotalCollected,
          total_pool: newTotalCollected * 0.7,        // 70% para el pozo
          bar_commission: newTotalCollected * 0.2,    // 20% para el bar
          platform_commission: newTotalCollected * 0.1, // 10% para la plataforma
          current_participants: sequelize.literal('current_participants + 1')
        }, {
          where: { id: prediction.room_id },
          transaction: options.transaction
        });
        
        console.log(`✅ Sala ${prediction.room_id} actualizada:`);
        console.log(`   - Recaudado total: R$ ${newTotalCollected.toFixed(2)}`);
        console.log(`   - Pozo ganador (70%): R$ ${(newTotalCollected * 0.7).toFixed(2)}`);
        console.log(`   - Comisión bar (20%): R$ ${(newTotalCollected * 0.2).toFixed(2)}`);
        console.log(`   - Comisión plataforma (10%): R$ ${(newTotalCollected * 0.1).toFixed(2)}`);
        console.log(`   - Participantes: +1`);
        
      } catch (error) {
        console.error('❌ Error actualizando sala:', error);
        throw error;
      }
    },
    
    // Si se elimina una predicción, restar del total
    afterDestroy: async (prediction, options) => {
      try {
        const Room = require('./Room');
        const amountPaid = parseFloat(prediction.entry_fee_paid);
        
        const room = await Room.findByPk(prediction.room_id, {
          transaction: options.transaction
        });
        
        if (room) {
          const currentCollected = parseFloat(room.total_collected || 0);
          const newTotalCollected = Math.max(0, currentCollected - amountPaid);
          
          await Room.update({
            total_collected: newTotalCollected,
            total_pool: newTotalCollected * 0.7,
            bar_commission: newTotalCollected * 0.2,
            platform_commission: newTotalCollected * 0.1,
            current_participants: sequelize.literal('GREATEST(current_participants - 1, 0)')
          }, {
            where: { id: prediction.room_id },
            transaction: options.transaction
          });
          
          console.log(`✅ Revertida actualización sala ${prediction.room_id}: -R$ ${amountPaid.toFixed(2)}`);
        }
      } catch (error) {
        console.error('❌ Error revirtiendo actualización:', error);
        throw error;
      }
    }
  }
});

module.exports = Prediction;