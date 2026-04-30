const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async (toEmail, resetLink, userName = '') => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'JugadaPlay <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Recupera tu contraseña - JugadaPlay',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Arial', sans-serif;
              background-color: #000000;
              margin: 0;
              padding: 40px 20px;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
              border: 1px solid rgba(255, 215, 0, 0.3);
              border-radius: 16px;
              padding: 40px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            }
            .logo-container {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              max-width: 180px;
              height: auto;
            }
            h2 {
              color: #FFD700;
              text-align: center;
              font-size: 24px;
              margin-bottom: 20px;
            }
            .message-box {
              background-color: rgba(255, 215, 0, 0.1);
              border-left: 4px solid #FFD700;
              padding: 15px;
              margin: 25px 0;
            }
            p {
              color: #e0e0e0;
              line-height: 1.6;
              font-size: 16px;
            }
            .button {
              display: inline-block;
              background-color: #FFD700;
              color: #000000;
              padding: 14px 35px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              font-size: 16px;
              margin: 25px 0;
              text-align: center;
              transition: background-color 0.3s;
            }
            .button:hover {
              background-color: #e6c200;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid rgba(255, 215, 0, 0.2);
              font-size: 12px;
              color: #888;
            }
            .warning {
              color: #ff6b6b;
              font-size: 13px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-container">
              <img src="${process.env.BACKEND_URL || 'https://backjugadaplay.onrender.com'}/logo-jugadaplay.svg" alt="JugadaPlay" class="logo">
            </div>
            
            <h2>🔄 Recupera tu contraseña</h2>
            
            <p>Hola <strong style="color: #FFD700;">${userName || 'usuario'}</strong>,</p>
            
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color: #FFD700;">JugadaPlay</strong>.</p>
            
            <div class="message-box">
              <p style="margin: 0;">🔐 <strong>¿No solicitaste esto?</strong><br>
              Ignora este mensaje. Tu contraseña seguirá siendo la misma.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">✨ Restablecer contraseña</a>
            </div>
            
            <p style="text-align: center;">Este enlace expirará en <strong style="color: #FFD700;">1 hora</strong>.</p>
            
            <div class="footer">
              <p>© 2026 JugadaPlay. Todos los derechos reservados.</p>
              <p class="warning">Si tienes problemas con el botón, copia y pega este enlace:<br>
              <span style="color: #FFD700; word-break: break-all;">${resetLink}</span></p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Error Resend:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Correo enviado a: ${toEmail}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPasswordResetEmail };