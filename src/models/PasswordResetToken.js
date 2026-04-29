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
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'password_reset_tokens',
  timestamps: true, // Esto hace que Sequelize espere las columnas createdAt y updatedAt
});