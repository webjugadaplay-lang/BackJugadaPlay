const nodemailer = require('nodemailer');

// Configuración simplificada para Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

// Función para enviar correo
const sendPasswordResetEmail = async (toEmail, resetLink, userName = '') => {
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
            <p style="color: #555; font-size: 16px;">
              Hola ${userName || 'usuario'},
            </p>
            <p style="color: #555; font-size: 16px;">
              Haz clic en el botón para restablecer tu contraseña:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #FFD700; color: #000000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Restablecer contraseña
              </a>
            </div>
            <p style="color: #777; font-size: 14px;">
              El enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
            </p>
            <hr style="margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2026 JugadaPlay
            </p>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo enviado a: ${toEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPasswordResetEmail };