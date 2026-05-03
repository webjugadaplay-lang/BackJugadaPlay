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

// Validar CNPJ brasileño
const validateCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  
  const invalidCNPJs = [
    '00000000000000', '11111111111111', '22222222222222',
    '33333333333333', '44444444444444', '55555555555555',
    '66666666666666', '77777777777777', '88888888888888',
    '99999999999999'
  ];
  if (invalidCNPJs.includes(cnpj)) return false;
  
  let sum = 0;
  let factor = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i)) * factor;
    factor = factor === 2 ? 9 : factor - 1;
  }
  let digit = sum % 11;
  digit = digit < 2 ? 0 : 11 - digit;
  if (digit !== parseInt(cnpj.charAt(12))) return false;
  
  sum = 0;
  factor = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i)) * factor;
    factor = factor === 2 ? 9 : factor - 1;
  }
  digit = sum % 11;
  digit = digit < 2 ? 0 : 11 - digit;
  return digit === parseInt(cnpj.charAt(13));
};

// Validar cédula colombiana - VERSIÓN MÁS FLEXIBLE
const validateColombianId = (cedula) => {
  cedula = cedula.replace(/\D/g, '');
  
  // Validar longitud (entre 7 y 10 dígitos)
  if (cedula.length < 7 || cedula.length > 10) return false;
  
  // No puede ser todos ceros
  if (/^0+$/.test(cedula)) return false;
  
  // Para cédulas de 10 dígitos, validar dígito verificador (opcional)
  // Si no pasa la validación del dígito, igual la aceptamos si es de 10 dígitos
  if (cedula.length === 10) {
    // Intentar validar dígito verificador
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
    
    // Si la validación falla, igual aceptamos (cédulas antiguas pueden no cumplir)
    // Solo mostramos un warning en consola
    if (checkDigit !== lastDigit) {
      console.log(`⚠️ Cédula ${cedula} no pasa validación de dígito verificador pero se acepta`);
    }
    
    return true; // Siempre true para cédulas de 10 dígitos
  }
  
  return true;
};

// Validar NIT colombiano
const validateNIT = (nit) => {
  nit = nit.replace(/\D/g, '');
  if (nit.length !== 10) return false;
  if (/^0+$/.test(nit)) return false;
  return true;
};

// Validar RFC Persona Moral mexicano (12 caracteres: 3 letras + 6 números + 3 caracteres)
const validateRFCPersonaMoral = (rfc) => {
  rfc = rfc.toUpperCase();
  const rfcRegex = /^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$/;
  return rfcRegex.test(rfc);
};

// Validar RFC Persona Física mexicano (13 caracteres: 4 letras + 6 números + 3 caracteres)
const validateRFCPersonaFisica = (rfc) => {
  rfc = rfc.toUpperCase();
  const rfcRegex = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
  return rfcRegex.test(rfc);
};

// Validar CURP mexicana (18 caracteres)
const validateCURP = (curp) => {
  curp = curp.toUpperCase();
  const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
  return curpRegex.test(curp);
};

// Validar documento según país (para JUGADOR)
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
      if (documentType === 'CURP') {
        if (cleanNumber.length !== 18) {
          return { isValid: false, message: 'CURP deve ter 18 caracteres' };
        }
        if (!validateCURP(cleanNumber)) {
          return { isValid: false, message: 'CURP inválida' };
        }
      }
      break;
  }
  
  return { isValid: true, message: '' };
};

// NUEVA FUNCIÓN: Validar documento para BAR según país y tipo
const validateBarDocument = (documentNumber, documentType, countryCode) => {
  if (!documentNumber) {
    return { isValid: false, message: 'Documento es requerido' };
  }

  switch (countryCode) {
    case 'BR':
      if (documentType === 'CNPJ') {
        if (!validateCNPJ(documentNumber)) {
          return { isValid: false, message: 'CNPJ inválido' };
        }
      } else if (documentType === 'CPF') {
        if (!validateCPF(documentNumber)) {
          return { isValid: false, message: 'CPF inválido' };
        }
      } else {
        return { isValid: false, message: 'Tipo de documento inválido para Brasil' };
      }
      break;
    
    case 'CO':
      if (documentType === 'NIT') {
        if (!validateNIT(documentNumber)) {
          return { isValid: false, message: 'NIT inválido' };
        }
      } else if (documentType === 'Cédula') {
        if (!validateColombianId(documentNumber)) {
          return { isValid: false, message: 'Cédula inválida' };
        }
      } else {
        return { isValid: false, message: 'Tipo de documento inválido para Colombia' };
      }
      break;
    
    case 'MX':
      if (documentType === 'RFC Persona Moral') {
        if (!validateRFCPersonaMoral(documentNumber)) {
          return { isValid: false, message: 'RFC Persona Moral inválido. Debe tener 12 caracteres (3 letras + 6 números + 3 caracteres)' };
        }
      } else if (documentType === 'RFC Persona Física') {
        if (!validateRFCPersonaFisica(documentNumber)) {
          return { isValid: false, message: 'RFC Persona Física inválido. Debe tener 13 caracteres (4 letras + 6 números + 3 caracteres)' };
        }
      } else if (documentType === 'CURP') {
        if (!validateCURP(documentNumber)) {
          return { isValid: false, message: 'CURP inválida. Debe tener 18 caracteres' };
        }
      } else {
        return { isValid: false, message: 'Tipo de documento inválido para México' };
      }
      break;
    
    default:
      return { isValid: false, message: 'País no soportado' };
  }

  return { isValid: true, message: '' };
};

// Validar teléfono según país - CORREGIDO
const validatePhone = (phone, phoneCountry) => {
  if (!phone) return { isValid: true, message: '' };
  
  // Limpiar: eliminar todo lo que no sea número
  const numbers = phone.replace(/\D/g, '');
  
  switch (phoneCountry) {
    case 'BR':
      if (numbers.length < 10 || numbers.length > 11) {
        return { isValid: false, message: 'Telefone brasileiro deve ter 10 ou 11 dígitos' };
      }
      break;
    
    case 'CO':
      // Colombia: debe tener exactamente 10 dígitos
      if (numbers.length !== 10) {
        return { isValid: false, message: 'Número colombiano deve ter 10 dígitos' };
      }
      break;
    
    case 'MX':
      if (numbers.length !== 10) {
        return { isValid: false, message: 'Número mexicano deve ter 10 dígitos' };
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

// Registro de usuario (bar o jugador) - MODIFICADO COMPLETO
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

    // ============ VALIDACIONES PARA BAR ============
    if (role === 'bar') {
      // Validar que lleguen los campos necesarios
      if (!documentNumber || !documentType || !countryCode) {
        return res.status(400).json({ 
          message: 'Documento, tipo de documento y país son requeridos para bares' 
        });
      }

      // Verificar documento único (por documentNumber)
      const existingDocument = await User.findOne({ 
        where: {
          [Sequelize.Op.or]: [
            { documentNumber: documentNumber },
            ...(documentType === 'CNPJ' ? [{ cnpj: documentNumber.replace(/\D/g, '') }] : []),
            ...(documentType === 'CPF' ? [{ cpf: documentNumber.replace(/\D/g, '') }] : [])
          ]
        }
      });
      
      if (existingDocument) {
        return res.status(400).json({ message: `${documentType} ya registrado` });
      }

      // Validar formato del documento según país
      const docValidation = validateBarDocument(documentNumber, documentType, countryCode);
      if (!docValidation.isValid) {
        return res.status(400).json({ message: docValidation.message });
      }
    }

    // ============ VALIDACIONES PARA JUGADOR ============
    if (role === 'player' && documentNumber) {
      // Verificar documento único
      const existingDocument = await User.findOne({ where: { documentNumber } });
      if (existingDocument) {
        return res.status(400).json({ message: `${documentType} ya registrado` });
      }

      // Validar documento según país
      const docValidation = validateDocument(documentNumber, documentType, countryCode);
      if (!docValidation.isValid) {
        return res.status(400).json({ message: docValidation.message });
      }
    }

    // ============ VALIDAR TELÉFONO ============
    const phoneValidation = validatePhone(phone, phoneCountry);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    // ============ CREAR USUARIO ============
    const userData = {
      email,
      password,
      role,
      name,
      phone,
      phoneCountry: phoneCountry || null,
      countryCode: countryCode || null,
    };

    if (role === 'bar') {
      // Para México, no eliminamos caracteres especiales porque el RFC/CURP tiene letras
      let cleanDocument = documentNumber;
      let cnpjValue = null;
      let cpfValue = null;
      
      if (countryCode === 'BR') {
        cleanDocument = documentNumber.replace(/\D/g, '');
        if (documentType === 'CNPJ') {
          cnpjValue = cleanDocument;
        } else if (documentType === 'CPF') {
          cpfValue = cleanDocument;
        }
      } else if (countryCode === 'CO') {
        if (documentType === 'NIT') {
          cleanDocument = documentNumber.replace(/-/g, '').replace(/\D/g, '');
        } else if (documentType === 'Cédula') {
          cleanDocument = documentNumber.replace(/\D/g, '');
        }
      } else if (countryCode === 'MX') {
        // México: mantener mayúsculas, no limpiar caracteres especiales
        cleanDocument = documentNumber.toUpperCase();
      }
      
      userData.barName = barName;
      userData.address = address;
      userData.documentType = documentType;
      userData.documentNumber = cleanDocument;
      userData.cnpj = cnpjValue;
      userData.cpf = cpfValue;
    } else if (role === 'player') {
      userData.playerNickname = playerNickname || name;
      userData.documentType = documentType || null;
      userData.documentNumber = documentNumber || null;
    }

    // Crear usuario
    const user = await User.create(userData);

    const token = generateToken(user);

    // Respuesta exitosa
    const responseData = {
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
      }
    };

    if (role === 'bar') {
      responseData.user.barName = user.barName;
      responseData.user.address = user.address;
      responseData.user.documentType = user.documentType;
    } else if (role === 'player') {
      responseData.user.playerNickname = user.playerNickname;
      responseData.user.documentType = user.documentType;
    }

    res.status(201).json(responseData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
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

    const responseData = {
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
      }
    };

    if (user.role === 'bar') {
      responseData.user.barName = user.barName;
      responseData.user.address = user.address;
      responseData.user.documentType = user.documentType;
    } else if (user.role === 'player') {
      responseData.user.playerNickname = user.playerNickname;
      responseData.user.documentType = user.documentType;
    }

    res.json(responseData);

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