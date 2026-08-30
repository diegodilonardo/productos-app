const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const repository = require('../repositories/password-reset.repository');
const smtpService = require('./smtp.service');

function texto(valor) {
  return String(valor ?? '').trim();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function baseUrl() {
  const valor = texto(process.env.APP_BASE_URL).replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(valor)) {
    throw new Error('Falta APP_BASE_URL válido en .env para generar el enlace de recuperación.');
  }
  return valor;
}

async function solicitarRecuperacion({ identificador, ip, userAgent }) {
  const clave = texto(identificador);
  const respuestaPublica = {
    ok: true,
    mensaje: 'Si el usuario existe y tiene un correo configurado, recibirá un enlace para restablecer su contraseña.'
  };

  if (!clave || clave.length > 200) {
    return respuestaPublica;
  }

  const usuario = await repository.buscarUsuarioPorIdentificador(clave);
  if (!usuario || !texto(usuario.EMAIL)) {
    return respuestaPublica;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const minutos = Math.min(120, Math.max(10, Number(process.env.PASSWORD_RESET_MINUTES || 30)));

  await repository.crearToken({
    idUsuario: usuario.ID_USUARIO,
    tokenHash,
    minutosValidez: minutos,
    ip,
    userAgent
  });

  const enlace = `${baseUrl()}/restablecer-password?token=${encodeURIComponent(token)}`;
  const nombre = texto(usuario.NOMBRE) || texto(usuario.USUARIO);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
      <h2>PRODUCTOS APP</h2>
      <p>Hola ${nombre.replace(/[<>&"]/g, '')},</p>
      <p>Se solicitó restablecer la contraseña de tu cuenta.</p>
      <p><a href="${enlace}">Restablecer contraseña</a></p>
      <p>El enlace vence en ${minutos} minutos y puede utilizarse una sola vez.</p>
      <p>Si no realizaste esta solicitud, podés ignorar este correo.</p>
    </div>`;

  await smtpService.enviarCorreo({
    para: usuario.EMAIL,
    asunto: 'PRODUCTOS APP - Restablecer contraseña',
    html
  });

  return respuestaPublica;
}

async function restablecerPassword({ token, password }) {
  const tokenLimpio = texto(token);
  const clave = String(password ?? '');

  if (!/^[a-f0-9]{64}$/i.test(tokenLimpio)) {
    const error = new Error('El enlace de recuperación es inválido.');
    error.status = 400;
    throw error;
  }
  if (clave.length < 8 || clave.length > 200) {
    const error = new Error('La nueva contraseña debe tener entre 8 y 200 caracteres.');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(clave, 12);
  await repository.restablecerPasswordConToken({
    tokenHash: hashToken(tokenLimpio),
    passwordHash
  });

  return {
    ok: true,
    mensaje: 'Contraseña actualizada correctamente. Ya puede iniciar sesión con la nueva contraseña.'
  };
}

module.exports = {
  solicitarRecuperacion,
  restablecerPassword
};
