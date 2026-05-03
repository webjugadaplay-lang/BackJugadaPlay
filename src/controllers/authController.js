const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../services/emailService');
const jwt = require('jsonwebtoken');

// ============ NUEVAS FUNCIONES DE VALIDACIÓN ============

// Validar CPF brasileño (con dígitos verificadores)
const validateCPF = (cpf) => {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  
  const invalidCPFs = [
    '00000000000', '11111111111', '22222222222', '33333333333',
    '44444444444', '55555555555', '66666666666', '77777777777',
    '88888888888', '99999999999'
  ];
  if (invalidCPFs.includes(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === parseInt(cpf.charAt(10));
};

// Validar cédula colombiana
const validateColombianId = (cedula) => {
  cedula = cedula.replace(/\D/g, '');
  if (cedula.length < 7 || cedula.length > 10) return false;
  if (/^0+$/.test(cedula)) return false;
  
  const totalDigits = cedula.length;
  let sum = 0;
  
  for (let i = 0; i < totalDigits - 1; i++) {
    const digit = parseInt(cedula.charAt(i));
    const position = totalDigits - i;
    const factor = position < 3 ? position : position % 6 + 2;
    sum += digit * factor;
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  const lastDigit = parseInt(cedula.charAt(totalDigits - 1));
  
  return checkDigit === lastDigit;
};

// Validar documento según país
const validateDocument = (documentNumber, documentType, countryCode) => {
  if (!documentNumber) return { isValid: true, message: '' };
  
  const cleanNumber = documentNumber.replace(/\D/g, '');
  
  switch (countryCode) {
    case 'BR':
      if (documentType === 'CPF') {
        if (cleanNumber.length !== 11) {
          return { isValid: false, message: 'CPF deve ter 11 dígitos' };
        }
        if (!validateCPF(cleanNumber)) {
          return { isValid: false, message: 'CPF inválido' };
        }
      }
      break;
    
    case 'CO':
      if (documentType === 'Cédula') {
        if (cleanNumber.length < 7 || cleanNumber.length > 10) {
          return { isValid: false, message: 'Cédula deve ter entre 7 e 10 dígitos' };
        }
        if (!validateColombianId(cleanNumber)) {
          return { isValid: false, message: 'Cédula inválida' };
        }
      }
      break;
    
    case 'MX':
      if (documentType === 'CURP / INE') {
        if (cleanNumber.length < 10 || cleanNumber.length > 18) {
          return { isValid: false, message: 'Identificação deve ter entre 10 e 18 caracteres' };
        }
      }
      break;
  }
  
  return { isValid: true, message: '' };
};

// Validar teléfono según país
const validatePhone = (phone, phoneCountry) => {
  if (!phone) return { isValid: true, message: '' };
  
  const numbers = phone.replace(/\D/g, '');
  
  switch (phoneCountry) {
    case 'BR':
      if (numbers.length < 10 || numbers.length > 11) {
        return { isValid: false, message: 'Telefone brasileiro deve ter 10 ou 11 dígitos' };
      }
      break;
    
    case 'CO':
      if (numbers.length !== 10) {
        return { isValid: false, message: 'Telefone colombiano deve ter 10 dígitos' };
      }
      break;
    
    case 'MX':
      if (numbers.length !== 10) {
        return { isValid: false, message: 'Telefone mexicano deve ter 10 dígitos' };
      }
      break;
  }
  
  return { isValid: true, message: '' };
};

// ============ FIN NUEVAS FUNCIONES ============

// Generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Registro de usuario (bar o jugador) - MODIFICADO
exports.register = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      role, 
      name, 
      phone, 
      phoneCountry,
      barName, 
      cnpj, 
      cpf,
      address, 
      playerNickname,
      documentType,
      documentNumber,
      countryCode
    } = req.body;

    // Verificar si ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email ya registrado' });
    }

    // NUEVO: Verificar documento único (solo para jugadores)
    if (role === 'player' && documentNumber) {
      const existingDocument = await User.findOne({ where: { documentNumber } });
      if (existingDocument) {
        return res.status(400).json({ message: `${documentType} ya registrado` });
      }
    }

    // NUEVO: Validar documento según país
    if (role === 'player' && documentNumber) {
      const docValidation = validateDocument(documentNumber, documentType, countryCode);
      if (!docValidation.isValid) {
        return res.status(400).json({ message: docValidation.message });
      }
    }

    // NUEVO: Validar teléfono
    const phoneValidation = validatePhone(phone, phoneCountry);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    // Crear usuario con los nuevos campos
    const user = await User.create({
      email,
      password,
      role,
      name,
      phone,
      phoneCountry: phoneCountry || null,
      countryCode: countryCode || null,
      barName: role === 'bar' ? barName : null,
      cnpj: role === 'bar' ? cnpj : null,
      cpf: role === 'bar' ? cpf : null,
      address: role === 'bar' ? address : null,
      playerNickname: role === 'player' ? (playerNickname || name) : null,
      // NUEVOS: Campos de identificación para jugador
      documentType: role === 'player' ? documentType : null,
      documentNumber: role === 'player' ? documentNumber : null,
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
        phone: user.phone,
        phoneCountry: user.phoneCountry,
        countryCode: user.countryCode,
        documentType: user.documentType,
        barName: user.barName || null,
        playerNickname: user.playerNickname || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Login (sin cambios, pero la respuesta incluye más campos)
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
        phone: user.phone,
        phoneCountry: user.phoneCountry,
        countryCode: user.countryCode,
        documentType: user.documentType,
        barName: user.barName || null,
        playerNickname: user.playerNickname || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Forgot password (sin cambios)
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

// Verificar token de recuperación (sin cambios)
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

// Restablecer contraseña (sin cambios)
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