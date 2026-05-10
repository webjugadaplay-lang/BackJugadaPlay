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
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nickname: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 100],
    },
  },
  role: {
    type: DataTypes.ENUM('owner', 'player', 'admin'),
    allowNull: false,
    defaultValue: 'player',
  },
  country: {
    type: DataTypes.ENUM('BR', 'CO', 'MX'),
    allowNull: false,
  },
  phoneCountry: {
    type: DataTypes.STRING(5),
    field: 'phone_country',
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  documentType: {
    type: DataTypes.STRING(20),
    field: 'document_type',
    allowNull: false,
  },
  documentNumber: {
  type: DataTypes.STRING(20),
  field: 'document_number',
  allowNull: false,
  unique: false,
},
}, {
  timestamps: true,
  tableName: 'users',
});

// Relación: User tiene muchos Bars
User.associate = (models) => {
  User.hasMany(models.Bar, {
    foreignKey: 'ownerId',
    as: 'bars',
  });
};

User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.prototype.validPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;