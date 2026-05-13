const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const User = require('../models/User');
const Bar = require('../models/Bar');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../services/emailService');
const jwt = require('jsonwebtoken');

// ============ VALIDACIONES SIMPLIFICADAS ============

// Validar CPF brasileño - Solo verifica longitud y que no sean todos dígitos iguales
const validateCPF = (cpf) => {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 111.111.111-11, etc.
  return true;
};

// Validar CNPJ brasileño - Solo verifica longitud y que no sean todos dígitos iguales
const validateCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  return true;
};

// Validar cédula colombiana - Solo verifica longitud entre 7 y 10
const validateColombianId = (cedula) => {
  cedula = cedula.replace(/\D/g, '');
  if (cedula.length < 7 || cedula.length > 10) return false;
  if (/^0+$/.test(cedula)) return false;
  return true;
};

// Validar NIT colombiano - Solo verifica 10 dígitos
const validateNIT = (nit) => {
  nit = nit.replace(/\D/g, '');
  if (nit.length !== 10) return false;
  if (/^0+$/.test(nit)) return false;
  return true;
};

// Validar RFC Persona Moral mexicano - Solo verifica 12 caracteres alfanuméricos
const validateRFCPersonaMoral = (rfc) => {
  rfc = rfc.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return rfc.length === 12;
};

// Validar RFC Persona Física mexicano - Solo verifica 13 caracteres alfanuméricos
const validateRFCPersonaFisica = (rfc) => {
  rfc = rfc.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return rfc.length === 13;
};

// Validar CURP mexicana - Solo verifica 18 caracteres alfanuméricos
const validateCURP = (curp) => {
  curp = curp.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return curp.length === 18;
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
        const cleanCNPJ = documentNumber.replace(/\D/g, '');
        if (!validateCNPJ(cleanCNPJ)) {
          return { isValid: false, message: 'CNPJ inválido' };
        }
      } else if (documentType === 'CPF') {
        const cleanCPF = documentNumber.replace(/\D/g, '');
        if (!validateCPF(cleanCPF)) {
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
          return { isValid: false, message: 'RFC Persona Moral inválido' };
        }
      } else if (documentType === 'RFC Persona Física') {
        if (!validateRFCPersonaFisica(documentNumber)) {
          return { isValid: false, message: 'RFC Persona Física inválido' };
        }
      } else if (documentType === 'CURP') {
        if (!validateCURP(documentNumber)) {
          return { isValid: false, message: 'CURP inválida' };
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

// ============ FIN VALIDACIONES ============

// Generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Registro de usuario (player o owner)
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      role,
      name,
      nickname,
      phone,
      phoneCountry,
      documentType,
      documentNumber,
      country,
      barName,
      address
    } = req.body;

    if (!country) {
      return res.status(400).json({ message: 'El campo country es requerido (BR, CO, MX)' });
    }

    // ============ LÓGICA PARA OWNER (BAR) ============
    if (role === 'owner' || role === 'bar') {

      // Validar campos requeridos
      if (!barName) {
        return res.status(400).json({ message: 'Nombre del bar es requerido' });
      }
      if (!address) {
        return res.status(400).json({ message: 'Dirección del bar es requerida' });
      }

      // Buscar si el usuario owner ya existe por email
      let existingOwner = await User.findOne({
        where: {
          email: email,
          role: 'owner'
        }
      });

      if (existingOwner) {
        // Usuario owner ya existe - solo crear un nuevo bar
        console.log("Owner existente, creando nuevo bar...");

        // Verificar que no exista un bar con el mismo nombre para este owner
        const existingBar = await Bar.findOne({
          where: {
            ownerId: existingOwner.id,
            barName: barName
          }
        });

        if (existingBar) {
          return res.status(400).json({
            message: `Ya tienes un bar con el nombre "${barName}". Usa otro nombre.`
          });
        }

        // Crear el nuevo bar
        const newBar = await Bar.create({
          ownerId: existingOwner.id,
          barName: barName,
          address: address,
          isActive: true,
        });

        const token = generateToken(existingOwner);

        // Obtener todos los bares del owner
        const allBars = await Bar.findAll({
          where: { ownerId: existingOwner.id },
          attributes: ['id', 'barName', 'address', 'isActive']
        });

        return res.status(201).json({
          message: `Bar "${barName}" registrado exitosamente`,
          token,
          user: {
            id: existingOwner.id,
            email: existingOwner.email,
            role: 'bar',
            name: existingOwner.name,
            nickname: existingOwner.nickname,
            country: existingOwner.country,
          },
          bar: {
            id: newBar.id,
            barName: newBar.barName,
            address: newBar.address,
            isActive: newBar.isActive,
          },
          allBars: allBars
        });
      }

      // Si no existe owner, crear nuevo usuario owner con su primer bar
      console.log("Nuevo owner, creando usuario y bar...");

      // Validar documento
      if (!documentNumber || !documentType) {
        return res.status(400).json({
          message: 'Documento y tipo de documento son requeridos para nuevo dueño'
        });
      }

      // Validar documento único para nuevo owner
      const existingDocument = await User.findOne({
        where: {
          documentNumber: documentNumber,
          role: 'owner'
        }
      });
      if (existingDocument) {
        return res.status(400).json({ message: `${documentType} ya registrado como dueño de bar` });
      }

      const docValidation = validateBarDocument(documentNumber, documentType, country);
      if (!docValidation.isValid) {
        return res.status(400).json({ message: docValidation.message });
      }

      // Validar teléfono
      const phoneValidation = validatePhone(phone, phoneCountry);
      if (!phoneValidation.isValid) {
        return res.status(400).json({ message: phoneValidation.message });
      }

      // Limpiar documento
      let cleanDocument = documentNumber;
      if (country === 'BR' && (documentType === 'CPF' || documentType === 'CNPJ')) {
        cleanDocument = documentNumber.replace(/\D/g, '');
      } else if (country === 'CO' && (documentType === 'Cédula' || documentType === 'NIT')) {
        cleanDocument = documentNumber.replace(/\D/g, '');
      } else if (country === 'MX') {
        cleanDocument = documentNumber ? documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
      }

      // Crear usuario owner
      const userData = {
        email,
        password,
        role: 'owner',
        name,
        nickname: nickname || name,
        country: country,
        phoneCountry: phoneCountry,
        phone: phone ? phone.replace(/\D/g, '') : null,
        documentType: documentType || null,
        documentNumber: cleanDocument || null,
      };

      const user = await User.create(userData);

      // Crear su primer bar
      const newBar = await Bar.create({
        ownerId: user.id,
        barName: barName,
        address: address,
        isActive: true,
      });

      const token = generateToken(user);

      return res.status(201).json({
        message: 'Bar registrado exitosamente',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: 'bar',
          name: user.name,
          nickname: user.nickname,
          country: user.country,
        },
        bar: {
          id: newBar.id,
          barName: newBar.barName,
          address: newBar.address,
          isActive: newBar.isActive,
        }
      });
    }

    // ============ LÓGICA PARA PLAYER ============
    if (role === 'player') {
      // Verificar si el jugador ya existe por email
      const existingPlayer = await User.findOne({
        where: {
          email: email,
          role: 'player'
        }
      });

      if (existingPlayer) {
        return res.status(400).json({
          message: 'Ya tienes una cuenta como jugador. Inicia sesión.'
        });
      }

      // Validar documento
      if (documentNumber) {
        const existingDocument = await User.findOne({
          where: {
            documentNumber: documentNumber,
            role: 'player'
          }
        });
        if (existingDocument) {
          return res.status(400).json({ message: `${documentType} ya registrado como jugador` });
        }

        const docValidation = validateDocument(documentNumber, documentType, country);
        if (!docValidation.isValid) {
          return res.status(400).json({ message: docValidation.message });
        }
      }

      // Validar teléfono
      const phoneValidation = validatePhone(phone, phoneCountry);
      if (!phoneValidation.isValid) {
        return res.status(400).json({ message: phoneValidation.message });
      }

      // Limpiar documento
      let cleanDocument = documentNumber;
      if (country === 'BR' && documentType === 'CPF') {
        cleanDocument = documentNumber.replace(/\D/g, '');
      } else if (country === 'CO' && documentType === 'Cédula') {
        cleanDocument = documentNumber.replace(/\D/g, '');
      } else if (country === 'MX') {
        cleanDocument = documentNumber ? documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
      }

      // Crear jugador
      const userData = {
        email,
        password,
        role: 'player',
        name,
        nickname: nickname || name,
        country: country,
        phoneCountry: phoneCountry,
        phone: phone ? phone.replace(/\D/g, '') : null,
        documentType: documentType || null,
        documentNumber: cleanDocument || null,
      };

      const user = await User.create(userData);
      const token = generateToken(user);

      return res.status(201).json({
        message: 'Jugador registrado exitosamente',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          nickname: user.nickname,
          country: user.country,
        }
      });
    }

    return res.status(400).json({ message: 'Rol no válido' });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    let { email, password, role } = req.body;

    // Normalizar rol: si viene 'bar', buscamos 'owner' en la BD
    let dbRole = role;
    if (role === 'bar') {
      dbRole = 'owner';
    }

    const user = await User.findOne({ where: { email, role: dbRole } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isValid = await user.validPassword(password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    let bars = [];
    if (user.role === 'owner') {
      bars = await Bar.findAll({
        where: { ownerId: user.id },
        attributes: ['id', 'barName', 'address', 'isActive']
      });
    }

    const token = generateToken(user);

    const responseData = {
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role, // ✅ CAMBIADO: usar el rol real de la BD
        name: user.name,
        nickname: user.nickname,
        phone: user.phone,
        phoneCountry: user.phoneCountry,
        country: user.country,
        documentType: user.documentType,
      }
    };

    if (bars.length > 0) {
      responseData.bars = bars;
      // ✅ Si es owner, también podemos incluir el primer bar por defecto
      if (bars.length > 0) {
        responseData.bars = bars;
        responseData.user.barId = bars[0].id;
        responseData.user.barName = bars[0].barName;
        responseData.user.barName = bars[0].barName;
        responseData.user.barId = bars[0].id;
      }
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