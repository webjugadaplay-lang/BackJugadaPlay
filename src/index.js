const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);

const statsRoutes = require('./routes/statsRoutes');
const barRoutes = require('./routes/barRoutes');
const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/stats', statsRoutes);
app.use('/api/bar', barRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando' });
});

// Sincronizar base de datos
sequelize.sync()
  .then(async () => {
    console.log('Base de datos sincronizada');

    // Cargar modelos
    const User = require('./models/User');
    const Room = require('./models/Room');
    const Prediction = require('./models/Prediction');
    const Payment = require('./models/Payment');
    const MatchResult = require('./models/MatchResult');
    const Continent = require('./models/Continent');
    const Country = require('./models/Country');
    const Tournament = require('./models/Tournament');
    const Team = require('./models/Team');

    // Configurar asociaciones
    const models = { User, Room, Prediction, Payment, MatchResult, Continent, Country, Tournament, Team };
    Object.values(models).forEach(model => {
      if (model.associate) model.associate(models);
    });

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error conectando a la base de datos:', err);
  });