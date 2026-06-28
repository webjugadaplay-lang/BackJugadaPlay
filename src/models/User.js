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
    allowNull: true,
  },
  documentNumber: {
    type: DataTypes.STRING(20),
    field: 'document_number',
    allowNull: false,
    unique: true,
  },
}, {
  timestamps: true,
  tableName: 'users',
});

// ✅ RELACIONES CORREGIDAS
User.associate = (models) => {
  if (models.Bar) {
    User.hasMany(models.Bar, {
      foreignKey: 'ownerId',
      as: 'bars',
    });
  }
  
  if (models.Prediction) {
    User.hasMany(models.Prediction, {
      foreignKey: 'user_id',
      as: 'predictions'
    });
  }
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