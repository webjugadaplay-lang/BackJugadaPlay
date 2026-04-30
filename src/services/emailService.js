const nodemailer = require('nodemailer');
const dns = require('dns');

// Forzar IPv4 a nivel de DNS
dns.setDefaultResultOrder('ipv4first');

// Configurar el transporte con múltiples opciones
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Opciones de conexión
  family: 4,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  // Deshabilitar IPv6 explícitamente
  localAddress: '0.0.0.0',
  // Opciones de socket
  socketOptions: {
    family: 4
  }
});

// Función para enviar correo con reintentos
const sendPasswordResetEmail = async (toEmail, resetLink, userName = '', retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const mailOptions = {
        from: `"JugadaPlay" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Recupera tu contraseña - JugadaPlay',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Recupera tu contraseña</title>
          </head>
          <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #FFD700; margin: 0;">JugadaPlay</h1>
              </div>
              <h2 style="color: #333; text-align: center;">Recupera tu contraseña</h2>
              <p style="color: #555; font-size: 16px; line-height: 1.5;">
                Hola ${userName || 'usuario'},
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.5;">
                Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #FFD700; color: #000000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Restablecer contraseña
                </a>
              </div>
              <p style="color: #777; font-size: 14px;">
                Si no solicitaste esto, ignora este correo. El enlace expira en 1 hora.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2026 JugadaPlay
              </p>
            </div>
          </body>
          </html>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Correo enviado a: ${toEmail} (intento ${i + 1})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Intento ${i + 1} fallido:`, error.message);
      if (i === retries) {
        return { success: false, error: error.message };
      }
      // Esperar 1 segundo antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

module.exports = { sendPasswordResetEmail };