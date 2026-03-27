const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Country = sequelize.define('Country', {
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
  flag: {
    type: DataTypes.STRING(255),
  },
  continent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'continents',
      key: 'id',
    },
  },
}, {
  timestamps: true,
  tableName: 'countries',
});

Country.associate = (models) => {
  Country.belongsTo(models.Continent, { foreignKey: 'continent_id', as: 'continent' });
  Country.hasMany(models.Tournament, { foreignKey: 'country_id', as: 'tournaments' });
};

module.exports = Country;