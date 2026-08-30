const crypto = require('crypto');
const repository = require('../repositories/perfil.repository');
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
    throw new Error('Falta APP_BASE_URL válido en .env.');
  }
  return valor;
}

function validarEmail(email) {
  const valor = texto(email).toLowerCase();
  if (valor.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    const error = new Error('Debe informar un email válido.');
    error.status = 400;
    throw error;
  }

  const dominioPermitido = texto(process.env.EMAIL_ALLOWED_DOMAIN || 'atomik.com.ar').toLowerCase();
  if (dominioPermitido && !valor.endsWith(`@${dominioPermitido}`)) {
    const error = new Error(`El email debe pertenecer al dominio @${dominioPermitido}.`);
    error.status = 400;
    throw error;
  }
  return valor;
}

async function obtenerPerfil(contexto) {
  const perfil = await repository.obtenerPerfil(Number(contexto.idUsuario));
  if (!perfil || !Boolean(perfil.ACTIVO)) {
    const error = new Error('Usuario no encontrado o inactivo.');
    error.status = 404;
    throw error;
  }
  return {
    idUsuario: perfil.ID_USUARIO,
    usuario: perfil.USUARIO,
    nombre: perfil.NOMBRE,
    email: perfil.EMAIL,
    emailPendiente: perfil.EMAIL_PENDIENTE,
    emailVerificado: Boolean(perfil.EMAIL_VERIFICADO),
    emailVerificadoEn: perfil.EMAIL_VERIFICADO_EN,
    fechaUltimoLogin: perfil.FECHA_ULTIMO_LOGIN
  };
}

async function actualizarNombre(contexto, nombre) {
  const valor = texto(nombre);
  if (valor.length < 2 || valor.length > 150) {
    const error = new Error('El nombre debe tener entre 2 y 150 caracteres.');
    error.status = 400;
    throw error;
  }
  await repository.actualizarNombre(Number(contexto.idUsuario), valor);
  return { nombre: valor };
}

async function solicitarCambioEmail(contexto, { email, ip, userAgent }) {
  const idUsuario = Number(contexto.idUsuario);
  const nuevo = validarEmail(email);
  const perfil = await repository.obtenerPerfil(idUsuario);

  if (!perfil || !Boolean(perfil.ACTIVO)) {
    const error = new Error('Usuario no encontrado o inactivo.');
    error.status = 404;
    throw error;
  }

  if (texto(perfil.EMAIL).toLowerCase() === nuevo && Boolean(perfil.EMAIL_VERIFICADO)) {
    const error = new Error('Ese email ya es el email verificado de su cuenta.');
    error.status = 400;
    throw error;
  }

  if (await repository.emailEnUso(nuevo, idUsuario)) {
    const error = new Error('Ese email ya está asociado o pendiente de verificación en otro usuario.');
    error.status = 409;
    throw error;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const minutos = Math.min(1440, Math.max(10, Number(process.env.EMAIL_VERIFY_MINUTES || 30)));

  await repository.crearSolicitudEmail({
    idUsuario,
    emailNuevo: nuevo,
    tokenHash: hashToken(token),
    minutosValidez: minutos,
    ip,
    userAgent
  });

  const enlace = `${baseUrl()}/verificar-email?token=${encodeURIComponent(token)}`;
  const nombre = texto(perfil.NOMBRE) || texto(perfil.USUARIO);

  await smtpService.enviarCorreo({
    para: nuevo,
    asunto: 'PRODUCTOS APP - Verificar email',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <h2>PRODUCTOS APP</h2>
        <p>Hola ${nombre.replace(/[<>&"]/g, '')},</p>
        <p>Recibimos una solicitud para asociar este email a tu cuenta.</p>
        <p><a href="${enlace}">Confirmar email</a></p>
        <p>El enlace vence en ${minutos} minutos y puede utilizarse una sola vez.</p>
        <p>Si no realizaste esta solicitud, podés ignorar este mensaje.</p>
      </div>`
  });

  return {
    ok: true,
    emailPendiente: nuevo,
    mensaje: `Enviamos un enlace de verificación a ${nuevo}. El email actual no cambiará hasta que lo confirmes.`
  };
}

async function confirmarEmail(token) {
  const tokenLimpio = texto(token);
  if (!/^[a-f0-9]{64}$/i.test(tokenLimpio)) {
    const error = new Error('El enlace de verificación es inválido.');
    error.status = 400;
    throw error;
  }
  return repository.confirmarEmail({ tokenHash: hashToken(tokenLimpio) });
}

module.exports = {
  obtenerPerfil,
  actualizarNombre,
  solicitarCambioEmail,
  confirmarEmail
};
