const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');

// Generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Registro de usuario (bar o jugador)
exports.register = async (req, res) => {
  try {
    const { email, password, role, name, phone, barName, cnpj, address, playerNickname } = req.body;

    // Verificar si ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email ya registrado' });
    }

    // Crear usuario
    const user = await User.create({
      email,
      password,
      role,
      name,
      phone,
      barName: role === 'bar' ? barName : null,
      cnpj: role === 'bar' ? cnpj : null,
      address: role === 'bar' ? address : null,
      playerNickname: role === 'player' ? playerNickname : null,
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Buscar usuario por email y role
    const user = await User.findOne({ where: { email, role } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isValid = await user.validPassword(password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        barName: user.barName || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email es requerido' });
    }

    // Buscar usuario por email
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    // Verificar si el usuario NO existe
    if (!user) {
      return res.status(404).json({ 
        message: 'Correo electrónico no registrado' 
      });
    }

    // Si el usuario existe, generar token y enviar email
    // Generar token seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar token
    await PasswordResetToken.create({
      user_id: user.id,
      token: hashedToken,
      expires_at: expiresAt,
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    // TODO: Enviar email (por ahora solo log)
    console.log('=== ENLACE DE RECUPERACIÓN ===');
    console.log(`Email: ${email}`);
    console.log(`Token: ${resetToken}`);
    console.log(`Enlace: ${resetUrl}`);
    console.log('==============================');

    // Respuesta específica para cuando el email existe
    return res.status(200).json({
      message: `Revisa el email ${email}, recibirás un enlace para recuperar tu contraseña.`
    });

  } catch (error) {
    console.error('Error en forgotPassword:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};
