// backend/src/models/Bar.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bar = sequelize.define('Bar', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ownerId: {
    type: DataTypes.UUID,
    field: 'owner_id',
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  barName: {
    type: DataTypes.STRING,
    field: 'bar_name',
    allowNull: false,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true,
  },
}, {
  timestamps: true,
  tableName: 'bars',
  indexes: [
    {
      unique: true,
      fields: ['owner_id', 'bar_name'],
      name: 'unique_bar_name_per_owner',
    },
  ],
});

// Relación: Bar pertenece a un User
Bar.associate = (models) => {
  Bar.belongsTo(models.User, {
    foreignKey: 'ownerId',
    as: 'owner',
  });
};

module.exports = Bar;