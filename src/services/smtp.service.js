const tls = require('tls');

function texto(valor) {
  return String(valor ?? '').trim();
}

function booleanoEnv(valor, defecto = false) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return defecto;
  }
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(String(valor).trim().toLowerCase());
}

function codificarHeader(valor) {
  return `=?UTF-8?B?${Buffer.from(String(valor), 'utf8').toString('base64')}?=`;
}

function crearLector(socket, timeoutMs) {
  let buffer = '';
  const pendientes = [];

  function procesar() {
    while (pendientes.length) {
      const lineas = buffer.split(/\r?\n/);
      if (lineas.length < 2) return;

      let fin = -1;
      let codigo = null;
      for (let i = 0; i < lineas.length - 1; i += 1) {
        const m = lineas[i].match(/^(\d{3})([ -])/);
        if (m) {
          codigo = Number(m[1]);
          if (m[2] === ' ') {
            fin = i;
            break;
          }
        }
      }

      if (fin < 0) return;

      const respuesta = lineas.slice(0, fin + 1).join('\n');
      buffer = lineas.slice(fin + 1).join('\n');
      const pendiente = pendientes.shift();
      clearTimeout(pendiente.timer);
      pendiente.resolve({ codigo, respuesta });
    }
  }

  socket.on('data', chunk => {
    buffer += chunk.toString('utf8');
    procesar();
  });

  return function leer() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = pendientes.findIndex(x => x.resolve === resolve);
        if (i >= 0) pendientes.splice(i, 1);
        reject(new Error('Timeout esperando respuesta del servidor SMTP.'));
      }, timeoutMs);
      pendientes.push({ resolve, reject, timer });
      procesar();
    });
  };
}

function validarCodigo(respuesta, permitidos, etapa) {
  if (!permitidos.includes(respuesta.codigo)) {
    throw new Error(`SMTP ${etapa}: ${respuesta.respuesta}`);
  }
}

async function enviarCorreo({ para, asunto, html, textoPlano }) {
  const host = texto(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = booleanoEnv(process.env.SMTP_SECURE, true);
  const usuario = texto(process.env.SMTP_USER);
  const password = String(process.env.SMTP_PASSWORD ?? '');
  const from = texto(process.env.SMTP_FROM) || usuario;
  const timeoutMs = Math.max(5000, Number(process.env.SMTP_TIMEOUT_MS || 15000));

  if (!host || !Number.isInteger(port) || port <= 0 || !usuario || !password || !from) {
    throw new Error('Configuración SMTP incompleta. Revise SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM.');
  }
  if (!secure) {
    throw new Error('Esta implementación requiere SMTP_SECURE=true (TLS directo, puerto 465).');
  }
  if (!texto(para)) {
    throw new Error('No se informó destinatario de correo.');
  }

  const socket = tls.connect({
    host,
    port,
    servername: host,
    rejectUnauthorized: !booleanoEnv(process.env.SMTP_ALLOW_INVALID_CERT, false)
  });
  socket.setTimeout(timeoutMs);

  const leer = crearLector(socket, timeoutMs);
  const escribir = linea => socket.write(`${linea}\r\n`, 'utf8');
  const comando = async (linea, codigos, etapa) => {
    escribir(linea);
    const respuesta = await leer();
    validarCodigo(respuesta, codigos, etapa);
    return respuesta;
  };

  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('Timeout conectando al servidor SMTP.')));
    });

    validarCodigo(await leer(), [220], 'saludo');
    const ehlo = await comando(`EHLO ${texto(process.env.SMTP_EHLO) || 'productos-app'}`, [250], 'EHLO');

    if (/AUTH[^\n]*LOGIN/i.test(ehlo.respuesta)) {
      await comando('AUTH LOGIN', [334], 'AUTH LOGIN');
      await comando(Buffer.from(usuario, 'utf8').toString('base64'), [334], 'usuario');
      await comando(Buffer.from(password, 'utf8').toString('base64'), [235], 'autenticación');
    } else if (/AUTH[^\n]*PLAIN/i.test(ehlo.respuesta)) {
      const authPlain = Buffer.from(`\0${usuario}\0${password}`, 'utf8').toString('base64');
      await comando(`AUTH PLAIN ${authPlain}`, [235], 'autenticación');
    } else {
      throw new Error('El servidor SMTP no informa AUTH LOGIN ni AUTH PLAIN.');
    }

    const emailFrom = (from.match(/<([^>]+)>/) || [null, from])[1];
    await comando(`MAIL FROM:<${emailFrom}>`, [250], 'MAIL FROM');
    await comando(`RCPT TO:<${texto(para)}>`, [250, 251], 'RCPT TO');
    await comando('DATA', [354], 'DATA');

    const cuerpo = html
      ? Buffer.from(String(html), 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n')
      : Buffer.from(String(textoPlano || ''), 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');

    const contentType = html ? 'text/html' : 'text/plain';
    const mensaje = [
      `From: ${from}`,
      `To: ${texto(para)}`,
      `Subject: ${codificarHeader(asunto)}`,
      'MIME-Version: 1.0',
      `Content-Type: ${contentType}; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
      '',
      cuerpo,
      '.'
    ].join('\r\n');

    socket.write(`${mensaje}\r\n`, 'utf8');
    validarCodigo(await leer(), [250], 'envío');

    try {
      await comando('QUIT', [221], 'QUIT');
    } catch (_) {}

    return { ok: true };
  } finally {
    socket.end();
    socket.destroy();
  }
}

module.exports = { enviarCorreo };
