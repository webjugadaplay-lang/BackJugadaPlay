require('dotenv').config();
const express = require('express');
const http = require('http'); // 👈 CAMBIO 1: Importar http
const socketIO = require('socket.io'); // 👈 CAMBIO 2: Importar socket.io
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
const playerRoutes = require('./routes/playerRoutes');

const app = express();
const PORT = process.env.PORT || 10000;

// 👈 CAMBIO 3: Crear servidor HTTP manualmente (en lugar de app.listen)
const server = http.createServer(app);

// 👈 CAMBIO 4: Configurar Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://tu-frontend.com", // Cambia por tu URL del frontend en Render
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 👈 CAMBIO 5: Middleware para hacer io accesible en las rutas
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

// 👈 CAMBIO 6: Configurar eventos de Socket.IO
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
  console.log(`🟢 Cliente WebSocket conectado: ${socket.id} - Usuario: ${socket.userId}`);

  // Unirse a una sala específica
  socket.on('join-live-room', (roomId) => {
    const roomName = `live-room-${roomId}`;
    socket.join(roomName);
    console.log(`📺 Cliente ${socket.id} se unió a la sala: ${roomName}`);
  });

  // Salir de una sala
  socket.on('leave-live-room', (roomId) => {
    const roomName = `live-room-${roomId}`;
    socket.leave(roomName);
    console.log(`📺 Cliente ${socket.id} salió de la sala: ${roomName}`);
  });

  // Actualizar marcador (solo admin/bar pueden usar esto)
  socket.on('update-match-score', async (data) => {
    try {
      const { roomId, goals_home, goals_away } = data;
      
      // Verificar permisos
      if (socket.userRole !== 'admin' && socket.userRole !== 'bar') {
        socket.emit('error', { message: 'No autorizado para actualizar el marcador' });
        return;
      }

      console.log(`⚽ Actualizando marcador - Sala ${roomId}: ${goals_home} x ${goals_away} por ${socket.userId}`);

      // Obtener el fixture_id de la sala
      const [room] = await sequelize.query(
        `SELECT fixture_id FROM rooms WHERE id = :roomId`,
        { replacements: { roomId }, type: sequelize.QueryTypes.SELECT }
      );

      if (room && room.fixture_id) {
        // Actualizar el fixture
        await sequelize.query(
          `UPDATE fixtures 
           SET goals_home = :goals_home, 
               goals_away = :goals_away,
               updated_at = NOW()
           WHERE id = :fixtureId`,
          {
            replacements: { 
              goals_home, 
              goals_away, 
              fixtureId: room.fixture_id 
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );

        // Emitir a todos los clientes conectados a esta sala
        const roomName = `live-room-${roomId}`;
        io.to(roomName).emit('score-updated', {
          goals_home,
          goals_away,
          timestamp: new Date().toISOString(),
          updatedBy: socket.userId
        });

        console.log(`✅ Marcador actualizado y emitido a sala: ${roomName}`);
        
        // Confirmar al admin que se actualizó
        socket.emit('score-update-confirmed', { 
          success: true, 
          goals_home, 
          goals_away 
        });
      } else {
        socket.emit('error', { message: 'Sala no tiene fixture asociado' });
      }

    } catch (error) {
      console.error('Error actualizando marcador:', error);
      socket.emit('error', { message: 'Error al actualizar el marcador' });
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log(`🔴 Cliente WebSocket desconectado: ${socket.id}`);
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

    // 👈 CAMBIO 7: Usar server.listen en lugar de app.listen
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`🔌 WebSocket Socket.IO habilitado`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

startServer();