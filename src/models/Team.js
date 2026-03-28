const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Team = sequelize.define('Team', {
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
    allowNull: false,
    references: {
      model: 'countries',
      key: 'id',
    },
  },
  tournament_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tournaments',
      key: 'id',
    },
  },
  logo: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'teams',
});

Team.associate = (models) => {
  Team.belongsTo(models.Country, { foreignKey: 'country_id', as: 'country' });
  Team.belongsTo(models.Tournament, { foreignKey: 'tournament_id', as: 'tournament' });
};

module.exports = Team;