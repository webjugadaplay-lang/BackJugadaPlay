// backend/src/models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('bar', 'player', 'admin'),
    allowNull: false,
    defaultValue: 'player',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
  },
  // Campos específicos para bar
  barName: {
    type: DataTypes.STRING,
    field: 'bar_name',
  },
  cnpj: {
    type: DataTypes.STRING,
  },
  address: {
    type: DataTypes.TEXT,
  },
  // Campos específicos para jugador
  playerNickname: {
    type: DataTypes.STRING,
    field: 'player_nickname',
  },
}, {
  timestamps: true,
  tableName: 'users',
});

// Hash de contraseña antes de crear/actualizar
User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Método para verificar contraseña
User.prototype.validPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Asociaciones (agregar después de la definición del modelo)
User.associate = (models) => {
  User.hasMany(models.Room, { foreignKey: 'bar_id' });
  User.hasMany(models.Prediction, { foreignKey: 'user_id' });
  User.hasMany(models.Payment, { foreignKey: 'user_id' });
  User.hasMany(models.PasswordResetToken, { foreignKey: 'userId' });
};

module.exports = User;