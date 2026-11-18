const fs = require('fs/promises');
const path = require('path');
const XLSX = require('xlsx');
const { getConnection, sql } = require('../config/database');
const { descargarArchivos } = require('./ftp.service');

const ARCHIVO_RELACIONES = 'TBL_RELACION.TXT';
const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024;

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return texto(valor).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
}

function decodificarArchivo(archivoBase64) {
  const limpio = texto(archivoBase64).replace(/^data:[^;]+;base64,/, '');
  if (!limpio) throw new Error('Seleccioná un archivo para simular el reorden.');
  const buffer = Buffer.from(limpio, 'base64');
  if (!buffer.length) throw new Error('El archivo está vacío.');
  if (buffer.length > MAX_ARCHIVO_BYTES) throw new Error('El archivo supera el máximo permitido de 8 MB.');
  return buffer;
}

function filasDesdeArchivo(nombreArchivo, buffer) {
  const extension = path.extname(texto(nombreArchivo)).toLowerCase();
  if (extension === '.xlsx' || extension === '.xls') {
    const libro = XLSX.read(buffer, { type: 'buffer', raw: false });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    if (!hoja) return [];
    const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: false });
    const primera = matriz[0] || [];
    const tieneCabecera = primera.some(celda => /COD.?ALFA|PROVEEDOR/i.test(texto(celda)));
    let indiceCodigo = 0;
    let indiceProveedor = 4;
    if (tieneCabecera) {
      indiceCodigo = primera.findIndex(celda => /COD.?ALFA|CODIGO/i.test(texto(celda)));
      indiceProveedor = primera.findIndex(celda => /PROVEEDOR/i.test(texto(celda)));
    }
    return matriz.slice(tieneCabecera ? 1 : 0).map((fila, indice) => ({
      numeroFila: indice + (tieneCabecera ? 2 : 1),
      codigoAlfa: texto(fila[indiceCodigo >= 0 ? indiceCodigo : 0]).toUpperCase(),
      proveedor: texto(fila[indiceProveedor >= 0 ? indiceProveedor : 4])
    })).filter(fila => fila.codigoAlfa);
  }

  if (!['.txt', '.csv', '.dbi'].includes(extension)) {
    throw new Error('Formato no admitido. Usá un archivo Excel (.xlsx/.xls) o texto (.txt/.csv).');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((linea, indice) => {
    const partes = linea.split(/[|;\t]/);
    return { numeroFila: indice + 1, codigoAlfa: texto(partes[0]).toUpperCase(), proveedor: texto(partes[1]) };
  }).filter(fila => fila.codigoAlfa && !/COD.?ALFA/i.test(fila.codigoAlfa));
}

function relacionesDesdeTexto(contenido) {
  const mapa = new Map();
  for (const linea of String(contenido || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const [moduloRaw, relacionadoRaw] = linea.split('|');
    const modulo = texto(moduloRaw).toUpperCase();
    const relacionado = texto(relacionadoRaw).toUpperCase();
    if (!modulo || !relacionado) continue;
    if (!mapa.has(modulo)) mapa.set(modulo, new Set());
    mapa.get(modulo).add(relacionado);
  }
  return new Map([...mapa].map(([codigo, relacionados]) => [codigo, [...relacionados]]));
}

function deducirSegunda(codigoPrimera) {
  const codigo = texto(codigoPrimera).toUpperCase();
  return codigo.length >= 11 && codigo[10] === '1'
    ? `${codigo.slice(0, 10)}2${codigo.slice(11)}`
    : null;
}

function datosCodigoAlfa(codigoAlfa) {
  const codigo = texto(codigoAlfa).toUpperCase();
  return {
    ano: codigo.slice(0, 2),
    temporada: codigo.slice(2, 3),
    rubro: codigo.slice(3, 4),
    modeloCrudo: codigo.slice(4, 10),
    modeloAlternativo: codigo.slice(4, 10).replace(/^0/, '')
  };
}

async function obtenerRutaRelaciones(idEmpresa) {
  const pool = await getConnection();
  const resultado = await pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`
    SELECT TOP 1 FTP_RUTA_MAESTROS
    FROM dbo.EMPRESAS_CONFIG
    WHERE ID_EMPRESA = @ID_EMPRESA AND ACTIVA = 1;
  `);
  const configurada = texto(resultado.recordset[0]?.FTP_RUTA_MAESTROS);
  return texto(process.env.REORDEN_RELACION_FTP_PATH) || configurada || '/PRODUCTOS/MAESTROS_MIDING';
}

async function cargarRelaciones(idEmpresa) {
  const carpeta = path.join(process.cwd(), 'tmp', 'reorden', String(idEmpresa));
  const rutaFTP = await obtenerRutaRelaciones(idEmpresa);
  const cacheEmpresa = path.join(carpeta, ARCHIVO_RELACIONES);
  const cacheHistorica = path.join(process.cwd(), 'tmp', ARCHIVO_RELACIONES);
  try {
    await descargarArchivos(rutaFTP, [ARCHIVO_RELACIONES], carpeta);
  } catch (error) {
    const cacheDisponible = await fs.access(cacheEmpresa).then(() => cacheEmpresa).catch(() =>
      fs.access(cacheHistorica).then(() => cacheHistorica).catch(() => null)
    );
    if (!cacheDisponible) throw error;
    console.warn(`[REORDEN] FTP no disponible; se utiliza la última copia local de ${ARCHIVO_RELACIONES}.`);
    const contenido = await fs.readFile(cacheDisponible, 'utf8');
    return relacionesDesdeTexto(contenido);
  }
  const contenido = await fs.readFile(cacheEmpresa, 'utf8');
  return relacionesDesdeTexto(contenido);
}

async function cargarCatalogos(idEmpresa, codigos) {
  const pool = await getConnection();
  const request = pool.request()
    .input('ID_EMPRESA', sql.Int, idEmpresa)
    .input('CODIGOS_JSON', sql.NVarChar(sql.MAX), JSON.stringify(codigos));
  const [modelos, marcas, rubros, temporadas, anos, proveedores, productos] = await Promise.all([
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT CODIGO_MODELO, DETALLE_MODELO, MARCA_MODELO, RUBRO_MODELO, LICENCIA FROM dbo.MAESTRO_MODELOS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1;`),
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT CODIGO_MARCA, DETALLE_MARCA FROM dbo.MAESTRO_MARCAS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1;`),
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT CODIGO_RUBRO, DETALLE_RUBRO FROM dbo.MAESTRO_RUBROS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1;`),
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT CODIGO_TEMPORADA, DETALLE_TEMPORADA FROM dbo.MAESTRO_TEMPORADAS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1;`),
    pool.request().input('ID_EMPRESA', sql.Int, idEmpresa).query(`SELECT CODIGO_ANO, DETALLE_ANO FROM dbo.MAESTRO_ANOS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1;`),
    pool.request().query(`SELECT CODIGO, NVA_RAZON_SOCIAL FROM dbo.MAESTRO_PROVEEDORES WHERE ACTIVO=1;`),
    request.query(`SELECT DISTINCT UPPER(LTRIM(RTRIM(P.CODIGO_ALFA))) CODIGO_ALFA FROM dbo.PRODUCTOS P INNER JOIN OPENJSON(@CODIGOS_JSON) J ON UPPER(LTRIM(RTRIM(P.CODIGO_ALFA)))=UPPER(J.[value]) WHERE P.ID_EMPRESA=@ID_EMPRESA;`)
  ]);
  return {
    modelos: modelos.recordset, marcas: marcas.recordset, rubros: rubros.recordset,
    temporadas: temporadas.recordset, anos: anos.recordset, proveedores: proveedores.recordset,
    existentes: new Set(productos.recordset.map(fila => texto(fila.CODIGO_ALFA).toUpperCase()))
  };
}

function buscarProveedor(alias, proveedores) {
  const buscado = normalizar(alias);
  if (!buscado) return null;
  const equivalencias = { LINKHO: 'PB0001', MARYCHEN: 'PB0041', IAN: 'PB0064' };
  const codigoPreferido = equivalencias[buscado];
  return proveedores.find(item => normalizar(item.CODIGO) === normalizar(codigoPreferido || buscado))
    || proveedores.find(item => normalizar(item.NVA_RAZON_SOCIAL).includes(buscado) || buscado.includes(normalizar(item.NVA_RAZON_SOCIAL)));
}

function construirPreview(filas, relaciones, catalogos) {
  const unicos = new Map();
  for (const fila of filas) if (!unicos.has(fila.codigoAlfa)) unicos.set(fila.codigoAlfa, fila);
  const errores = [];
  const advertencias = [];
  const grupos = new Map();
  const todosCodigos = new Set();
  const primerasUnicas = new Set();
  const segundasUnicas = new Set();
  let excepciones = 0;

  const modeloPorCodigo = new Map();
  for (const modelo of catalogos.modelos) modeloPorCodigo.set(normalizar(modelo.CODIGO_MODELO), modelo);
  const marcas = new Map(catalogos.marcas.map(item => [normalizar(item.DETALLE_MARCA), item]));
  const rubros = new Map(catalogos.rubros.map(item => [texto(item.CODIGO_RUBRO), item]));
  const temporadas = new Map(catalogos.temporadas.map(item => [texto(item.CODIGO_TEMPORADA), item]));
  const anos = new Map(catalogos.anos.map(item => [texto(item.CODIGO_ANO), item]));

  for (const fila of unicos.values()) {
    const relacionados = relaciones.get(fila.codigoAlfa);
    if (!relacionados?.length) {
      errores.push({ fila: fila.numeroFila, codigoAlfa: fila.codigoAlfa, mensaje: 'No existe en TBL_RELACION.TXT.' });
      continue;
    }
    const datos = datosCodigoAlfa(fila.codigoAlfa);
    const modelo = modeloPorCodigo.get(normalizar(datos.modeloCrudo)) || modeloPorCodigo.get(normalizar(datos.modeloAlternativo));
    const proveedor = buscarProveedor(fila.proveedor, catalogos.proveedores);
    if (!modelo) advertencias.push(`${fila.codigoAlfa}: no se encontró el modelo ${datos.modeloAlternativo || datos.modeloCrudo} en el maestro activo.`);
    if (!proveedor) advertencias.push(`${fila.codigoAlfa}: proveedor "${fila.proveedor || 'sin informar'}" no reconocido.`);
    const marca = marcas.get(normalizar(modelo?.MARCA_MODELO));
    const rubro = rubros.get(datos.rubro);
    const temporada = temporadas.get(datos.temporada);
    const ano = anos.get(datos.ano);
    const licencia = texto(modelo?.LICENCIA) || 'SIN LICENCIA';
    const clave = [datos.ano, datos.temporada, datos.rubro, marca?.CODIGO_MARCA || modelo?.MARCA_MODELO || '?', licencia].join('|');
    if (!grupos.has(clave)) grupos.set(clave, {
      clave, codigoAno: datos.ano, ano: ano?.DETALLE_ANO || (/^\d{2}$/.test(datos.ano) ? `20${datos.ano}` : datos.ano),
      codigoTemporada: datos.temporada, temporada: temporada?.DETALLE_TEMPORADA || datos.temporada,
      codigoRubro: datos.rubro, rubro: rubro?.DETALLE_RUBRO || modelo?.RUBRO_MODELO || datos.rubro,
      codigoMarca: marca?.CODIGO_MARCA || null, marca: marca?.DETALLE_MARCA || modelo?.MARCA_MODELO || 'SIN IDENTIFICAR',
      licencia, tipoProducto: 'MODULO', cantidadModulos: 0, cantidadPrimeras: 0,
      cantidadSegundas: 0, excepciones: 0, proveedores: new Map(), codigos: new Set(), primerasCodigos: new Set(), segundasCodigos: new Set()
    });
    const grupo = grupos.get(clave);
    grupo.cantidadModulos += 1;
    grupo.codigos.add(fila.codigoAlfa);
    todosCodigos.add(fila.codigoAlfa);
    const proveedorClave = proveedor?.CODIGO || `SIN_MAPEAR:${fila.proveedor || ''}`;
    if (!grupo.proveedores.has(proveedorClave)) grupo.proveedores.set(proveedorClave, { codigo: proveedor?.CODIGO || null, detalle: proveedor?.NVA_RAZON_SOCIAL || fila.proveedor || 'Sin informar', modulos: 0 });
    grupo.proveedores.get(proveedorClave).modulos += 1;
    for (const relacionado of relacionados) {
      todosCodigos.add(relacionado);
      if (relacionado.length >= 11 && relacionado[10] === '1') {
        primerasUnicas.add(relacionado); grupo.primerasCodigos.add(relacionado);
        const segunda = deducirSegunda(relacionado);
        if (segunda) { todosCodigos.add(segunda); segundasUnicas.add(segunda); grupo.segundasCodigos.add(segunda); grupo.codigos.add(segunda); }
      } else {
        excepciones += 1; grupo.excepciones += 1;
      }
      grupo.codigos.add(relacionado);
    }
  }

  const altas = [...grupos.values()].map(grupo => {
    const codigos = [...grupo.codigos];
    const existentes = codigos.filter(codigo => catalogos.existentes.has(codigo)).length;
    return { ...grupo, cantidadPrimeras: grupo.primerasCodigos.size, cantidadSegundas: grupo.segundasCodigos.size, proveedores: [...grupo.proveedores.values()], codigos: undefined, primerasCodigos: undefined, segundasCodigos: undefined, productosTotales: codigos.length, productosExistentes: existentes, productosAReemitir: codigos.length - existentes };
  }).sort((a, b) => `${a.codigoAno}${a.codigoTemporada}`.localeCompare(`${b.codigoAno}${b.codigoTemporada}`));

  const existentes = [...todosCodigos].filter(codigo => catalogos.existentes.has(codigo)).length;
  return {
    simulacion: true,
    resumen: { filasArchivo: filas.length, modulosUnicos: unicos.size, filasDuplicadas: filas.length - unicos.size, modulosEncontrados: unicos.size - errores.length, modulosSinRelacion: errores.length, primeras: primerasUnicas.size, segundasDeducidas: segundasUnicas.size, relacionesExcepcionales: excepciones, productosUnicos: todosCodigos.size, productosExistentes: existentes, productosAReemitir: todosCodigos.size - existentes, altasPropuestas: altas.length },
    altas, errores, advertencias: [...new Set(advertencias)]
  };
}

async function simularReorden({ idEmpresa, nombreArchivo, archivoBase64 }) {
  const buffer = decodificarArchivo(archivoBase64);
  const filas = filasDesdeArchivo(nombreArchivo, buffer);
  if (!filas.length) throw new Error('No se encontraron códigos alfa en el archivo.');
  const relaciones = await cargarRelaciones(idEmpresa);
  const codigosPrevios = new Set();
  for (const fila of filas) {
    codigosPrevios.add(fila.codigoAlfa);
    for (const relacionado of relaciones.get(fila.codigoAlfa) || []) {
      codigosPrevios.add(relacionado);
      const segunda = deducirSegunda(relacionado);
      if (segunda) codigosPrevios.add(segunda);
    }
  }
  const catalogos = await cargarCatalogos(idEmpresa, [...codigosPrevios]);
  return construirPreview(filas, relaciones, catalogos);
}

module.exports = { simularReorden, _internals: { filasDesdeArchivo, relacionesDesdeTexto, deducirSegunda, datosCodigoAlfa, construirPreview, buscarProveedor } };
