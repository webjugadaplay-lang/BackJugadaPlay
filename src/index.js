require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const createAdmin = require('./scripts/createAdmin');

// Importar modelos
const User = require('./models/User');
const PasswordResetToken = require('./models/PasswordResetToken');
const Fixture = require('./models/Fixture');
const UserLeague = require('./models/UserLeague');
const Room = require('./models/Room');
const Prediction = require('./models/Prediction');

// ========== ASOCIACIONES (TODAS AQUÍ) ==========
// Prediction con Room
Prediction.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
Room.hasMany(Prediction, { foreignKey: 'room_id', as: 'predictions' });

// User con Prediction (si lo necesitas)
User.hasMany(Prediction, { foreignKey: 'user_id', as: 'predictions' });
Prediction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Asociación de Room con Fixture
Room.belongsTo(Fixture, { foreignKey: 'fixture_id', as: 'Fixture' });
Fixture.hasMany(Room, { foreignKey: 'fixture_id', as: 'rooms' });

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const leagueRoutes = require('./routes/league');
const barRoutes = require('./routes/barRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/league', leagueRoutes);
app.use('/api/bar', barRoutes);
app.use('/api', apiRoutes);

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando correctamente' });
});

// Endpoint de diagnóstico
app.get('/diagnostic', (req, res) => {
  const dns = require('dns');
  dns.lookup('smtp.gmail.com', { family: 4 }, (err, address) => {
    res.json({
      smtpIpv4: address,
      error: err?.message,
      nodeOptions: process.env.NODE_OPTIONS
    });
  });
});

// Sincronizar base de datos y levantar servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('📦 Conectado a PostgreSQL en Render...');

    await sequelize.sync({ alter: true });
    console.log('✅ Base de datos sincronizada');

    await createAdmin();
    console.log('✅ Admin verificado');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

startServer();