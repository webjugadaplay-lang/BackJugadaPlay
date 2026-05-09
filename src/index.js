// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Importar modelos
const User = require('./models/User');
const Bar = require('./models/Bar');
const PasswordResetToken = require('./models/PasswordResetToken');

// Importar rutas
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rutas
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando correctamente' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('📦 Conectado a PostgreSQL...');

    // Aplicar relaciones
    if (User.associate) User.associate({ Bar });
    if (Bar.associate) Bar.associate({ User });

    await sequelize.sync();
    await User.sync();
    await Bar.sync();
    await PasswordResetToken.sync();
    
    console.log('✅ Base de datos sincronizada');
    console.log('📊 Tablas: users, bars, password_reset_tokens');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

startServer();