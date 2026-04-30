require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Importar modelos
const User = require('./models/User');
const PasswordResetToken = require('./models/PasswordResetToken');

// Importar rutas
const authRoutes = require('./routes/authRoutes');

const app = express();
//const PORT = process.env.PORT || 3001;
const PORT = process.env.PORT || 10000; // Render espera 10000 por defecto

// Middlewares
app.use(cors());
app.use(express.json());

app.use(express.static('public'));

// Rutas
app.use('/api/auth', authRoutes);

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando correctamente' });
});

// Sincronizar base de datos y levantar servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('📦 Conectado a PostgreSQL en Render...');

    // Sincronizar modelos (sin alter para evitar errores)
    await sequelize.sync();
    await User.sync();
    await PasswordResetToken.sync();
    console.log('✅ Base de datos sincronizada');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    process.exit(1);
  }
};

// Endpoint de diagnóstico (temporal)
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

startServer();