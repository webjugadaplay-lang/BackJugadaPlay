const User = require('../models/User');

async function createAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.log('ADMIN_EMAIL o ADMIN_PASSWORD no definidos');
      return;
    }

    const exists = await User.findOne({ where: { email } });

    if (exists) {
      console.log('Admin ya existe');
      return;
    }

    await User.create({
      email,
      password, // Sequelize lo encripta automáticamente
      role: 'admin',
      name: 'Administrador'
    });

    console.log('Admin creado correctamente');
  } catch (error) {
    console.error('Error creando admin:', error);
  }
}

module.exports = createAdmin;