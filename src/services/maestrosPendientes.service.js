const repository = require('../repositories/altasMaestros.repository');
const { getConnection, sql } = require('../config/database');
const normalizar = valor => String(valor ?? '').trim().toUpperCase();

function transformar(solicitud) {
  const base = { PENDIENTE_MAESTRO: true, ACTIVO: 1 };
  if (solicitud.TIPO === 'COLOR') return { ...base, CODIGO_COLOR: solicitud.CODIGO, DETALLE_COLOR: solicitud.NOMBRE };
  if (solicitud.TIPO === 'MODELO') return { ...base, CODIGO_MODELO: solicitud.CODIGO, DETALLE_MODELO: solicitud.NOMBRE, MARCA_MODELO: solicitud.MARCA, RUBRO_MODELO: solicitud.RUBRO, LICENCIA: solicitud.LICENCIA, C_PROVEEDO: solicitud.C_PROVEEDO };
  const datos = JSON.parse(solicitud.DATOS_JSON || '{}');
  return { ...base, ...datos.distribucion, CODIGO_MODULO: solicitud.CODIGO, DETALLE_MODULO: solicitud.NOMBRE, PARES: datos.pares, ES_CONSISTENTE: 1 };
}

async function pendientes(idEmpresa, tipo) {
  return (await repository.listar(idEmpresa))
    .filter(s => s.TIPO === tipo && ['PENDIENTE_ENVIO', 'ENVIADO_PRESEA'].includes(s.ESTADO))
    .map(s => ({ solicitud: s, registro: transformar(s) }));
}

async function combinar(registros, idEmpresa, tipo, filtro = () => true) {
  const campo = { MODELO: 'CODIGO_MODELO', COLOR: 'CODIGO_COLOR', MODULO: 'CODIGO_MODULO' }[tipo];
  const codigos = new Set(registros.map(r => normalizar(r[campo])));
  const nuevos = (await pendientes(idEmpresa, tipo)).filter(x => filtro(x.solicitud) && !codigos.has(normalizar(x.registro[campo])));
  return [...registros, ...nuevos.map(x => x.registro)];
}

async function buscar(idEmpresa, tipo, codigo, marca, rubro) {
  const encontrado = (await pendientes(idEmpresa, tipo)).find(x => normalizar(x.solicitud.CODIGO) === normalizar(codigo) &&
    (tipo !== 'MODELO' || (normalizar(x.solicitud.MARCA) === normalizar(marca) && normalizar(x.solicitud.RUBRO) === normalizar(rubro))));
  return encontrado?.registro || null;
}

async function comprobarAlta(idAlta) {
  const pool = await getConnection();
  const resultado = await pool.request().input('ID_ALTA', sql.Int, Number(idAlta)).query(`
    SELECT DISTINCT X.TIPO, X.CODIGO
    FROM dbo.ALTAS_PRODUCTOS A JOIN dbo.ALTAS_PRODUCTOS_DETALLE D ON D.ID_ALTA=A.ID_ALTA
    CROSS APPLY (VALUES ('MODELO', D.CODIGO_MODELO), ('COLOR', D.CODIGO_COLOR), ('MODULO', D.CODIGO_MODULO)) X(TIPO,CODIGO)
    WHERE A.ID_ALTA=@ID_ALTA AND NULLIF(LTRIM(RTRIM(X.CODIGO)), '') IS NOT NULL
    AND NOT (
      (X.TIPO='MODELO' AND EXISTS (SELECT 1 FROM dbo.MAESTRO_MODELOS M WHERE M.ID_EMPRESA=A.ID_EMPRESA AND M.ACTIVO=1 AND M.CODIGO_MODELO=X.CODIGO)) OR
      (X.TIPO='COLOR' AND EXISTS (SELECT 1 FROM dbo.MAESTRO_COLORES C WHERE C.ID_EMPRESA=A.ID_EMPRESA AND C.ACTIVO=1 AND C.CODIGO_COLOR=X.CODIGO)) OR
      (X.TIPO='MODULO' AND EXISTS (SELECT 1 FROM dbo.MAESTRO_TALLES_MODULOS T WHERE T.ID_EMPRESA=A.ID_EMPRESA AND T.ACTIVO=1 AND T.CODIGO_MODULO=X.CODIGO))
    );`);
  if (resultado.recordset.length) throw Object.assign(new Error('No se puede enviar el DBI del alta. Faltan maestros activos sincronizados de Presea: ' + resultado.recordset.map(x => `${x.TIPO} ${x.CODIGO}`).join(', ') + '. Enviá los maestros y esperá su sincronización antes de reintentar.'), { status: 409 });
}
module.exports = { combinar, buscar, comprobarAlta, transformar };
