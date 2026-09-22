const sesiones = new Map();
const VENTANA_ACTIVA_MS = 5 * 60 * 1000;

function texto(valor) { return String(valor ?? '').trim(); }

function registrar(req) {
  const usuario = req.session?.usuario;
  const idSesion = texto(req.sessionID);
  if (!usuario || !idSesion) return;
  const ahora = new Date();
  const anterior = sesiones.get(idSesion);
  const empresas = Array.isArray(usuario.empresas) ? usuario.empresas : [];
  const idEmpresaSolicitada = Number(req.get?.('x-id-empresa')) || null;
  const accesoSolicitado = idEmpresaSolicitada
    ? empresas.find(item => Number(item.idEmpresa) === idEmpresaSolicitada)
    : null;
  const accesoUnico = empresas.length === 1 ? empresas[0] : null;
  const empresaAnterior = texto(anterior?.empresa);
  const empresaResuelta = texto(
    accesoSolicitado?.empresa ||
    accesoSolicitado?.codigoEmpresa ||
    empresaAnterior ||
    accesoUnico?.empresa ||
    accesoUnico?.codigoEmpresa
  );
  sesiones.set(idSesion, {
    idSesion,
    idUsuario: Number(usuario.idUsuario) || null,
    usuario: texto(usuario.usuario),
    nombre: texto(usuario.nombre) || texto(usuario.usuario),
    superAdmin: Boolean(usuario.superAdmin),
    empresa: empresaResuelta,
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
