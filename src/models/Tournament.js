const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tournament = sequelize.define('Tournament', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  country_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'countries',
      key: 'id',
    },
  },
  type: {
    type: DataTypes.STRING(50),
    defaultValue: 'League',
  },
}, {
  timestamps: false,
  tableName: 'tournaments',
});

Tournament.associate = (models) => {
  Tournament.belongsTo(models.Country, { foreignKey: 'country_id', as: 'country' });
};

module.exports = Tournament;