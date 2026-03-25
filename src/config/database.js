const { Sequelize } = require('sequelize');
require('dotenv').config();

// Usar la URL de Render si existe, si no usar SQLite local
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  console.log('📦 Conectando a PostgreSQL en Render...');
  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Importante para Render
      },
    },
  });
  module.exports = sequelize;
} else {
  console.log('📦 Usando SQLite local para desarrollo...');
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false,
  });
  module.exports = sequelize;
}