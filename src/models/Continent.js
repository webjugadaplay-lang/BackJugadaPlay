const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Continent = sequelize.define('Continent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  },
}, {
  timestamps: true,
  tableName: 'continents',
});

Continent.associate = (models) => {
  Continent.hasMany(models.Country, { foreignKey: 'continent_id', as: 'countries' });
};

module.exports = Continent;