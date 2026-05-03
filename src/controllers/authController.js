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

// Validar cédula colombiana - VERSIÓN SIMPLIFICADA (solo longitud y no ceros)
const validateColombianId = (cedula) => {
  cedula = cedula.replace(/\D/g, '');
  
  // Validar longitud (entre 7 y 10 dígitos)
  if (cedula.length < 7 || cedula.length > 10) return false;
  
  // No puede ser todos ceros
  if (/^0+$/.test(cedula)) return false;
  
  // Cédula válida (sin validación de dígito verificador)
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
  
  switch (countryCode) {
    case 'BR':
      const cleanCPF = documentNumber.replace(/\D/g, '');
      if (documentType === 'CPF') {
        if (cleanCPF.length !== 11) {
          return { isValid: false, message: 'CPF deve ter 11 dígitos' };
        }
        if (!validateCPF(cleanCPF)) {
          return { isValid: false, message: 'CPF inválido' };
        }
      }
      break;
    
    case 'CO':
      if (documentType === 'Cédula') {
        if (!validateColombianId(documentNumber)) {
          return { isValid: false, message: 'Cédula inválida. Debe tener entre 7 y 10 dígitos' };
        }
      }
      break;
    
    case 'MX':
      if (documentType === 'CURP') {
        if (!validateCURP(documentNumber)) {
          return { isValid: false, message: 'CURP inválida. Debe tener 18 caracteres' };
        }
      }
      break;
  }
  
  return { isValid: true, message: '' };
};

// Validar documento para BAR según país y tipo
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
          return { isValid: false, message: 'NIT inválido. Debe tener 10 dígitos' };
        }
      } else if (documentType === 'Cédula') {
        if (!validateColombianId(documentNumber)) {
          return { isValid: false, message: 'Cédula inválida. Debe tener entre 7 y 10 dígitos' };
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

// Registro de usuario (bar o jugador)
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
      if (!documentNumber || !documentType || !countryCode) {
        return res.status(400).json({ 
          message: 'Documento, tipo de documento y país son requeridos para bares' 
        });
      }

      // Verificar documento único
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

      const docValidation = validateBarDocument(documentNumber, documentType, countryCode);
      if (!docValidation.isValid) {
        return res.status(400).json({ message: docValidation.message });
      }
    }

    // ============ VALIDACIONES PARA JUGADOR ============
    if (role === 'player' && documentNumber) {
      const existingDocument = await User.findOne({ where: { documentNumber } });
      if (existingDocument) {
        return res.status(400).json({ message: `${documentType} ya registrado` });
      }

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
      phone: phone ? phone.replace(/\D/g, '') : null,
      phoneCountry: phoneCountry || null,
      countryCode: countryCode || null,
    };

    if (role === 'bar') {
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

    const user = await User.create(userData);
    const token = generateToken(user);

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

// Login
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ where: { email, role } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

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

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email es requerido' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({
        message: 'Correo electrónico no registrado'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.create({
      user_id: user.id,
      token: hashedToken,
      expires_at: expiresAt,
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const emailResult = await sendPasswordResetEmail(email, resetUrl, user.name);

    if (!emailResult.success) {
      console.error('Error al enviar correo:', emailResult.error);
    }

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

    const user = await User.findByPk(foundToken.user_id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.password = password;
    await user.save();

    foundToken.used_at = new Date();
    await foundToken.save();

    return res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};