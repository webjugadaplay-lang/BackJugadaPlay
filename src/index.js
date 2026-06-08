// src/index.js
require('dotenv').config();
const express = require('express');
const http = require('http'); // 👈 NUEVO
const socketIO = require('socket.io'); // 👈 NUEVO
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

// Importar servicio de sincronización 👈 NUEVO
const FixtureSyncService = require('./services/fixtureSyncService');

// ========== ASOCIACIONES (TODAS AQUÍ) ==========
Prediction.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
Room.hasMany(Prediction, { foreignKey: 'room_id', as: 'predictions' });

User.hasMany(Prediction, { foreignKey: 'user_id', as: 'predictions' });
Prediction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Room.belongsTo(Fixture, { foreignKey: 'fixture_id', as: 'Fixture' });
Fixture.hasMany(Room, { foreignKey: 'fixture_id', as: 'rooms' });

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const leagueRoutes = require('./routes/league');
const barRoutes = require('./routes/barRoutes');
const apiRoutes = require('./routes/apiRoutes');
const playerRoutes = require('./routes/playerRoutes');

const app = express();
const PORT = process.env.PORT || 10000;

// 👈 NUEVO: Crear servidor HTTP manualmente
const server = http.createServer(app);

// 👈 NUEVO: Configurar Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", // En producción, pon tu URL del frontend
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 👈 NUEVO: Middleware para hacer io accesible en las rutas
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/league', leagueRoutes);
app.use('/api/bar', barRoutes);
app.use('/api', apiRoutes);
app.use('/api/player', playerRoutes);

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

// 👈 NUEVO: Configurar eventos de Socket.IO
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`🟢 Cliente WebSocket conectado: ${socket.id}`);

  socket.on('join-live-room', (roomId) => {
    const roomName = `live-room-${roomId}`;
    socket.join(roomName);
    console.log(`📺 Cliente ${socket.id} se unió a la sala: ${roomName}`);
  });

  socket.on('leave-live-room', (roomId) => {
    const roomName = `live-room-${roomId}`;
    socket.leave(roomName);
    console.log(`📺 Cliente ${socket.id} salió de la sala: ${roomName}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Cliente WebSocket desconectado: ${socket.id}`);
  });
});

// 👈 NUEVO: Crear instancia del servicio de sincronización
const fixtureSyncService = new FixtureSyncService(io);

// Sincronizar base de datos y levantar servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('📦 Conectado a PostgreSQL en Render...');

    await sequelize.sync({ alter: true });
    console.log('✅ Base de datos sincronizada');

    await createAdmin();
    console.log('✅ Admin verificado');

    // 👈 CAMBIO IMPORTANTE: Usar server.listen en lugar de app.listen
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`🔌 WebSocket Socket.IO habilitado`);
      
      // 👈 NUEVO: Iniciar la sincronización automática con API-Football
      const syncInterval = process.env.SYNC_INTERVAL || 10; // segundos
      fixtureSyncService.start(syncInterval);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

startServer();