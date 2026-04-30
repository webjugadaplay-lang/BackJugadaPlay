const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async (toEmail, resetLink, userName = '') => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'JugadaPlay <onboarding@resend.dev>', // Cambiar después si verificas dominio
      to: [toEmail],
      subject: 'Recupera tu contraseña - JugadaPlay',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; padding: 30px;">
            <h1 style="color: #FFD700; text-align: center;">JugadaPlay</h1>
            <h2 style="color: #333;">Recupera tu contraseña</h2>
            <p>Hola ${userName || 'usuario'},</p>
            <p>Haz clic en el botón para restablecer tu contraseña:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #FFD700; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a>
            </div>
            <p>El enlace expira en 1 hora.</p>
            <p>Si no solicitaste esto, ignora este correo.</p>
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