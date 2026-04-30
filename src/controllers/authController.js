const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../services/emailService');
const jwt = require('jsonwebtoken');

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

    // Si el usuario existe, generar token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar token en la base de datos
    await PasswordResetToken.create({
      user_id: user.id,
      token: hashedToken,
      expires_at: expiresAt,
    });

    // Construir enlace de recuperación
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // ENVIAR CORREO REAL
    const emailResult = await sendPasswordResetEmail(email, resetUrl, user.name);

    if (!emailResult.success) {
      console.error('Error al enviar correo:', emailResult.error);
      // No mostramos error al usuario por seguridad, solo log interno
    }

    // Respuesta específica para cuando el email existe
    return res.status(200).json({
      message: `Revisa el email ${email}, recibirás un enlace para recuperar tu contraseña.`
    });

  } catch (error) {
    console.error('Error en forgotPassword:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Verificar token de recuperación
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token es requerido' });
    }

    // Buscar token en la base de datos (sin hashear, buscamos por token original no)
    // Nota: Como guardamos el token hasheado, necesitamos buscar todos los tokens válidos y comparar
    const validTokens = await PasswordResetToken.findAll({
      where: {
        used_at: null,
        expires_at: { [Sequelize.Op.gt]: new Date() } // Token no expirado
      }
    });

    let foundToken = null;
    for (const resetToken of validTokens) {
      const isValid = await bcrypt.compare(token, resetToken.token);
      if (isValid) {
        foundToken = resetToken;
        break;
      }
    }

    if (!foundToken) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    return res.status(200).json({ message: 'Token válido', userId: foundToken.user_id });
  } catch (error) {
    console.error('Error en verifyResetToken:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Restablecer contraseña
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token y contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar token válido
    const validTokens = await PasswordResetToken.findAll({
      where: {
        used_at: null,
        expires_at: { [Sequelize.Op.gt]: new Date() }
      }
    });

    let foundToken = null;
    for (const resetToken of validTokens) {
      const isValid = await bcrypt.compare(token, resetToken.token);
      if (isValid) {
        foundToken = resetToken;
        break;
      }
    }

    if (!foundToken) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Actualizar la contraseña del usuario
    const user = await User.findByPk(foundToken.user_id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar contraseña (el hook beforeUpdate se encargará del hasheo)
    user.password = password;
    await user.save();

    // Marcar token como usado
    foundToken.used_at = new Date();
    await foundToken.save();

    return res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};