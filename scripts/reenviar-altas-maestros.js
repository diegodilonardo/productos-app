require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const { getConnection, sql } = require('../src/config/database');
const { escribirDBFGenerico } = require('../src/services/dbfWriterGenerico.service');
const ftpService = require('../src/services/ftp.service');
const {
  definicionesDbi,
  resolverRutaDestinoMaestros,
  agruparArchivosMaestros
} = require('../src/services/altasMaestros.service');

const TIPOS_VALIDOS = new Set(['COLOR', 'MODELO', 'MODULO']);

function mostrarAyuda() {
  console.log(`
RECUPERACION DE ALTAS DE MAESTROS

Regenera archivos DBI históricos y, opcionalmente, los reenvía al FTP.
No modifica el estado de las solicitudes.

Uso recomendado en dos pasos:
  node scripts/reenviar-altas-maestros.js --empresa 70000 --ids 151,152,153
  node scripts/reenviar-altas-maestros.js --empresa 70000 --ids 151,152,153 --enviar

También se puede seleccionar un período:
  node scripts/reenviar-altas-maestros.js --empresa 70000 --desde 2026-10-08 --hasta 2026-10-09 --tipo MODELO

Opciones:
  --empresa CODIGO       Código de empresa obligatorio, por ejemplo 70000.
  --ids LISTA            IDs de ALTAS_MAESTROS separados por coma.
  --desde AAAA-MM-DD     Fecha inicial de envío, inclusive.
  --hasta AAAA-MM-DD     Fecha final de envío, inclusive.
  --tipo TIPO            COLOR, MODELO, MODULO o TODOS. Predeterminado: TODOS.
  --enviar               Realiza el envío. Sin esta opción solamente genera una vista previa.
  --sobrescribir         Permite reemplazar un archivo que ya existe en el FTP.
  --ayuda                 Muestra esta ayuda.

Debe indicarse --ids o --desde. Para evitar selecciones accidentales, no se
permite reenviar todas las solicitudes históricas sin un criterio explícito.
`);
}

function argumentos(argv) {
  const resultado = {
    empresa: '',
    ids: [],
    desde: '',
    hasta: '',
    tipo: 'TODOS',
    enviar: false,
    sobrescribir: false,
    ayuda: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const actual = argv[i];
    const siguiente = argv[i + 1];

    if (actual === '--enviar') resultado.enviar = true;
    else if (actual === '--sobrescribir') resultado.sobrescribir = true;
    else if (actual === '--ayuda' || actual === '-h') resultado.ayuda = true;
    else if (actual === '--empresa') { resultado.empresa = String(siguiente || '').trim(); i += 1; }
    else if (actual === '--ids') {
      resultado.ids = String(siguiente || '')
        .split(',')
        .map(valor => Number(valor.trim()))
        .filter(valor => Number.isInteger(valor) && valor > 0);
      i += 1;
    } else if (actual === '--desde') { resultado.desde = String(siguiente || '').trim(); i += 1; }
    else if (actual === '--hasta') { resultado.hasta = String(siguiente || '').trim(); i += 1; }
    else if (actual === '--tipo') { resultado.tipo = String(siguiente || '').trim().toUpperCase(); i += 1; }
    else throw new Error(`Opción desconocida: ${actual}`);
  }

  return resultado;
}

function fechaValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

function validar(opciones) {
  if (!opciones.empresa) throw new Error('Debe indicar --empresa con el código de empresa.');
  if (!opciones.ids.length && !opciones.desde) throw new Error('Debe indicar --ids o --desde.');
  if (opciones.desde && !fechaValida(opciones.desde)) throw new Error('--desde debe tener formato AAAA-MM-DD.');
  if (opciones.hasta && !fechaValida(opciones.hasta)) throw new Error('--hasta debe tener formato AAAA-MM-DD.');
  if (opciones.tipo !== 'TODOS' && !TIPOS_VALIDOS.has(opciones.tipo)) {
    throw new Error('--tipo debe ser COLOR, MODELO, MODULO o TODOS.');
  }
}

async function buscarEmpresa(pool, codigo) {
  const resultado = await pool.request()
    .input('CODIGO', sql.VarChar(30), codigo)
    .input('ID', sql.Int, /^\d+$/.test(codigo) ? Number(codigo) : -1)
    .query(`
      SELECT TOP 2 ID_EMPRESA, CODIGO_EMPRESA, RAZON_SOCIAL
      FROM dbo.EMPRESAS
      WHERE LTRIM(RTRIM(CODIGO_EMPRESA))=LTRIM(RTRIM(@CODIGO))
         OR ID_EMPRESA=@ID
      ORDER BY CASE WHEN LTRIM(RTRIM(CODIGO_EMPRESA))=LTRIM(RTRIM(@CODIGO)) THEN 0 ELSE 1 END;
    `);

  const exacta = resultado.recordset.find(
    fila => String(fila.CODIGO_EMPRESA || '').trim() === String(codigo).trim()
  );

  return exacta || resultado.recordset[0] || null;
}

async function obtenerSeleccion(pool, empresa, opciones) {
  const solicitud = pool.request()
    .input('ID_EMPRESA', sql.Int, empresa.ID_EMPRESA)
    .input('TIPO', sql.VarChar(20), opciones.tipo)
    .input('IDS', sql.VarChar(sql.MAX), opciones.ids.join(','))
    .input('DESDE', sql.Date, opciones.desde || null)
    .input('HASTA', sql.Date, opciones.hasta || null);

  const resultado = await solicitud.query(`
    SELECT A.*
    FROM dbo.ALTAS_MAESTROS A
    WHERE A.ID_EMPRESA=@ID_EMPRESA
      AND A.ESTADO IN ('ENVIADO_PRESEA','CONFIRMADO_ERP')
      AND (@TIPO='TODOS' OR A.TIPO=@TIPO)
      AND (
        (@IDS<>'' AND A.ID_ALTA_MAESTRO IN (
          SELECT TRY_CONVERT(INT,value) FROM STRING_SPLIT(@IDS,',')
        ))
        OR
        (@IDS='' AND @DESDE IS NOT NULL
          AND A.FECHA_ENVIO>=@DESDE
          AND (@HASTA IS NULL OR A.FECHA_ENVIO<DATEADD(DAY,1,@HASTA)))
      )
    ORDER BY A.TIPO,A.MARCA,A.LICENCIA,A.RUBRO,A.CODIGO;
  `);

  if (opciones.ids.length) {
    const encontrados = new Set(resultado.recordset.map(fila => Number(fila.ID_ALTA_MAESTRO)));
    const faltantes = opciones.ids.filter(id => !encontrados.has(id));
    if (faltantes.length) {
      throw new Error(
        `Los IDs ${faltantes.join(', ')} no pertenecen a la empresa, no coinciden con el tipo o no están enviados/confirmados.`
      );
    }
  }

  return resultado.recordset;
}

async function obtenerRutaConfigurada(pool, idEmpresa) {
  const resultado = await pool.request()
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .query(`
      SELECT TOP 1 RUTA_DESTINO
      FROM dbo.ALTAS_MAESTROS_CONFIGURACION
      WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1;
    `);

  return resolverRutaDestinoMaestros(resultado.recordset[0]?.RUTA_DESTINO || '');
}

function marcaTiempo() {
  const fecha = new Date();
  const parte = valor => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}${parte(fecha.getMonth() + 1)}${parte(fecha.getDate())}_${parte(fecha.getHours())}${parte(fecha.getMinutes())}${parte(fecha.getSeconds())}`;
}

function prepararArchivos(registros, rutaDestino, empresa) {
  const carpetaBase = path.join(
    process.env.EXPORT_PATH || path.join(process.cwd(), 'salidas'),
    'recuperacion-altas-maestros',
    String(empresa.CODIGO_EMPRESA || empresa.ID_EMPRESA),
    marcaTiempo()
  );

  const grupos = agruparArchivosMaestros(registros, rutaDestino);
  const archivos = grupos.map(grupo => {
    const definicion = definicionesDbi[grupo.tipo];
    const carpeta = path.join(carpetaBase, ...grupo.ruta.split('/').filter(Boolean));
    fs.mkdirSync(carpeta, { recursive: true });
    const rutaLocal = path.join(carpeta, definicion.archivo);
    escribirDBFGenerico(rutaLocal, grupo.filas.map(definicion.map), definicion.campos);
    return {
      ...grupo,
      nombre: definicion.archivo,
      rutaLocal,
      rutaFTP: `${grupo.ruta.replace(/\/+$/g, '')}/${definicion.archivo}`
    };
  });

  return { carpetaBase, archivos };
}

function imprimirVistaPrevia(empresa, registros, preparacion, opciones) {
  console.log('');
  console.log('============================================================');
  console.log(opciones.enviar ? ' REENVIO DE ALTAS DE MAESTROS' : ' VISTA PREVIA - NO SE ENVIARA NADA');
  console.log('============================================================');
  console.log(`Empresa: ${empresa.CODIGO_EMPRESA} - ${empresa.RAZON_SOCIAL || ''} (ID ${empresa.ID_EMPRESA})`);
  console.log(`Solicitudes seleccionadas: ${registros.length}`);
  console.log(`Carpeta local de recuperación: ${preparacion.carpetaBase}`);
  console.log('');

  for (const archivo of preparacion.archivos) {
    console.log(`${archivo.tipo}: ${archivo.nombre}`);
    console.log(`  Registros: ${archivo.filas.length}`);
    console.log(`  Destino:   ${archivo.rutaFTP}`);
    console.log(`  Códigos:   ${archivo.filas.map(fila => fila.CODIGO).join(', ')}`);
  }

  console.log('============================================================');
  console.log('');
}

async function registrarAuditoria(pool, empresa, archivo) {
  const ids = archivo.filas.map(fila => fila.ID_ALTA_MAESTRO).join(',');
  await pool.request()
    .input('ID_EMPRESA', sql.Int, empresa.ID_EMPRESA)
    .input('IDS', sql.VarChar(sql.MAX), ids)
    .input('OBSERVACION', sql.VarChar(500), `DBI regenerado y reenviado por recuperación a ${archivo.rutaFTP}`)
    .query(`
      INSERT dbo.ALTAS_MAESTROS_HISTORIAL
        (ID_ALTA_MAESTRO,ESTADO_ANTERIOR,ESTADO_NUEVO,OBSERVACION,USUARIO)
      SELECT A.ID_ALTA_MAESTRO,A.ESTADO,A.ESTADO,@OBSERVACION,'SCRIPT_RECUPERACION'
      FROM dbo.ALTAS_MAESTROS A
      WHERE A.ID_EMPRESA=@ID_EMPRESA
        AND A.ID_ALTA_MAESTRO IN (
          SELECT TRY_CONVERT(INT,value) FROM STRING_SPLIT(@IDS,',')
        );
    `);
}

async function ejecutar() {
  const opciones = argumentos(process.argv.slice(2));
  if (opciones.ayuda) {
    mostrarAyuda();
    return;
  }

  validar(opciones);
  const pool = await getConnection();
  const empresa = await buscarEmpresa(pool, opciones.empresa);
  if (!empresa) throw new Error(`No se encontró la empresa ${opciones.empresa}.`);

  const registros = await obtenerSeleccion(pool, empresa, opciones);
  if (!registros.length) throw new Error('No se encontraron solicitudes históricas con los criterios indicados.');

  const rutaDestino = await obtenerRutaConfigurada(pool, empresa.ID_EMPRESA);
  if (!rutaDestino) throw new Error('La empresa no tiene una ruta activa para Altas de Maestros.');

  const preparacion = prepararArchivos(registros, rutaDestino, empresa);
  imprimirVistaPrevia(empresa, registros, preparacion, opciones);

  if (!opciones.enviar) {
    console.log('Vista previa finalizada. Revisá los archivos y repetí el comando con --enviar para subirlos al FTP.');
    return;
  }

  for (const archivo of preparacion.archivos) {
    const existe = await ftpService.existeArchivo(archivo.ruta, archivo.nombre);
    if (existe && !opciones.sobrescribir) {
      throw new Error(
        `El archivo ${archivo.rutaFTP} ya existe en el FTP. No se reemplazó. ` +
        'Si verificaste que corresponde sobrescribirlo, repetí el comando con --sobrescribir.'
      );
    }

    const resultado = await ftpService.subirArchivo(
      archivo.rutaLocal,
      archivo.nombre,
      archivo.nombre,
      archivo.ruta
    );
    await registrarAuditoria(pool, empresa, archivo);
    console.log(`ENVIADO: ${resultado.rutaRemota || archivo.rutaFTP} (${archivo.filas.length} registros)`);
  }

  console.log('Recuperación completada correctamente.');
}

ejecutar()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('');
    console.error(`ERROR: ${error.message}`);
    console.error('');
    process.exit(1);
  });

