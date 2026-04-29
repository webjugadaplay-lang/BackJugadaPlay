const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users', // ← Cambiado de 'Users' a 'users' (minúscula)
      key: 'id',
    },
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at',
  },
}, {
  timestamps: true,
  tableName: 'password_reset_tokens',
});

module.exports = PasswordResetToken;