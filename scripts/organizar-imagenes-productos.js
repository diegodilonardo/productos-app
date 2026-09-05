require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getConnection } = require('../src/config/database');

const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png']);
const aplicar = process.argv.includes('--apply');

function texto(valor) {
  return String(valor ?? '').trim();
}

function segmento(valor, respaldo) {
  const normalizado = texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalizado || respaldo;
}

function carpetaRaiz() {
  const configurada = texto(process.env.IMAGENES_PRODUCTOS_PATH);
  return configurada
    ? path.resolve(configurada)
    : path.resolve(process.cwd(), 'storage', 'imagenes-productos');
}

function claveRegistro(fila) {
  return [fila.CODIGO_ANO, fila.CODIGO_TEMPORADA, fila.CODIGO_MODELO, fila.CODIGO_COLOR]
    .map(texto)
    .join('')
    .toLowerCase();
}

function destinoRegistro(raiz, fila, nombreArchivo) {
  return path.join(
    raiz,
    segmento(fila.RAZON_SOCIAL || fila.CODIGO_EMPRESA, `EMPRESA_${fila.ID_EMPRESA}`),
    segmento(fila.DETALLE_MARCA || fila.CODIGO_MARCA, 'SIN_MARCA'),
    segmento(fila.DETALLE_RUBRO || fila.CODIGO_RUBRO, 'SIN_RUBRO'),
    segmento(fila.LICENCIA || 'SIN_LICENCIA', 'SIN_LICENCIA'),
    nombreArchivo
  );
}

async function ejecutar() {
  const raiz = carpetaRaiz();
  if (!fs.existsSync(raiz)) throw new Error(`No existe la carpeta de imágenes: ${raiz}`);

  const archivos = fs.readdirSync(raiz, { withFileTypes: true })
    .filter(item => item.isFile() && EXTENSIONES.has(path.extname(item.name).toLowerCase()));

  const pool = await getConnection();
  const resultado = await pool.request().query(`
    SELECT DISTINCT
      A.ID_EMPRESA, E.CODIGO_EMPRESA, E.RAZON_SOCIAL,
      A.CODIGO_MARCA, A.DETALLE_MARCA,
      A.CODIGO_RUBRO, A.DETALLE_RUBRO,
      A.CODIGO_ANO, A.CODIGO_TEMPORADA,
      D.CODIGO_MODELO, D.CODIGO_COLOR,
      CASE
        WHEN NULLIF(LTRIM(RTRIM(D.LICENCIA)), '') IS NULL THEN 'SIN_LICENCIA'
        ELSE LTRIM(RTRIM(D.LICENCIA))
      END AS LICENCIA
    FROM dbo.ALTAS_PRODUCTOS A
    INNER JOIN dbo.EMPRESAS E ON E.ID_EMPRESA = A.ID_EMPRESA
    INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE D
      ON D.ID_EMPRESA = A.ID_EMPRESA AND D.ID_ALTA = A.ID_ALTA
    WHERE ISNULL(D.GENERADO_AUTOMATICO, 0) = 0;
  `);

  const porClave = new Map();
  for (const fila of resultado.recordset) {
    const clave = claveRegistro(fila);
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave).push(fila);
  }

  const resumen = {
    modo: aplicar ? 'APLICAR' : 'SIMULACION',
    archivosPlanos: archivos.length,
    archivosRelacionados: 0,
    copiasNecesarias: 0,
    copiasRealizadas: 0,
    yaExistentes: 0,
    conflictos: 0,
    sinRelacion: []
  };

  for (const archivo of archivos) {
    const clave = path.parse(archivo.name).name.toLowerCase();
    const relaciones = porClave.get(clave) || [];
    if (!relaciones.length) {
      resumen.sinRelacion.push(archivo.name);
      continue;
    }

    resumen.archivosRelacionados += 1;
    const origen = path.join(raiz, archivo.name);
    const destinos = new Set(relaciones.map(fila => destinoRegistro(raiz, fila, archivo.name)));

    for (const destino of destinos) {
      if (fs.existsSync(destino)) {
        const origenStat = fs.statSync(origen);
        const destinoStat = fs.statSync(destino);
        if (origenStat.size === destinoStat.size) resumen.yaExistentes += 1;
        else resumen.conflictos += 1;
        continue;
      }

      resumen.copiasNecesarias += 1;
      if (aplicar) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(origen, destino, fs.constants.COPYFILE_EXCL);
        resumen.copiasRealizadas += 1;
      }
    }
  }

  console.log(JSON.stringify({
    ...resumen,
    sinRelacion: resumen.sinRelacion.slice(0, 30),
    cantidadSinRelacion: resumen.sinRelacion.length
  }, null, 2));

  await pool.close();
}

ejecutar().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
