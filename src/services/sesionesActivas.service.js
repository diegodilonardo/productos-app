const sesiones = new Map();
const VENTANA_ACTIVA_MS = 5 * 60 * 1000;

function texto(valor) { return String(valor ?? '').trim(); }

function registrar(req) {
  const usuario = req.session?.usuario;
  const idSesion = texto(req.sessionID);
  if (!usuario || !idSesion) return;
  const ahora = new Date();
  const anterior = sesiones.get(idSesion);
  const idEmpresa = Number(req.get?.('x-id-empresa')) || null;
  const acceso = idEmpresa
    ? (usuario.empresas || []).find(item => Number(item.idEmpresa) === idEmpresa)
    : null;
  sesiones.set(idSesion, {
    idSesion,
    idUsuario: Number(usuario.idUsuario) || null,
    usuario: texto(usuario.usuario),
    nombre: texto(usuario.nombre) || texto(usuario.usuario),
    superAdmin: Boolean(usuario.superAdmin),
    empresa: texto(acceso?.empresa || acceso?.codigoEmpresa),
    fechaInicio: anterior?.fechaInicio || ahora,
    ultimaActividad: ahora
  });
}

function eliminar(idSesion) { sesiones.delete(texto(idSesion)); }

function listar() {
  const limite = Date.now() - VENTANA_ACTIVA_MS;
  for (const [id, sesion] of sesiones.entries()) {
    if (new Date(sesion.ultimaActividad).getTime() < limite) sesiones.delete(id);
  }
  return [...sesiones.values()]
    .sort((a, b) => new Date(b.ultimaActividad) - new Date(a.ultimaActividad))
    .map(({ idSesion, ...sesion }) => sesion);
}

module.exports = { registrar, eliminar, listar, VENTANA_ACTIVA_MS };
