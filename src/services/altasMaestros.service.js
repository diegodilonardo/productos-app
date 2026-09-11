const repository = require('../repositories/altasMaestros.repository');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const maestrosRepository = require('../repositories/maestros.repository');
const { escribirDBFGenerico } = require('./dbfWriterGenerico.service');
const ftpService = require('./ftp.service');

function resolverRutaDestinoMaestros(rutaConfigurada) {
  const ruta = String(rutaConfigurada || '').trim().replaceAll('/', '\\');
  if (!ruta) return null;
  const sinServidor = ruta.replace(/^\\\\[^\\]+\\[^\\]+\\/i, '').replace(/^\\+/, '');
  if (/^ALTAS_MAESTROS\\/i.test(sinServidor)) return `/${sinServidor.replaceAll('\\', '/')}`;
  throw Object.assign(new Error('La ruta de Altas de Maestros debe comenzar con ALTAS_MAESTROS.'), { status: 409 });
}

const largos = { COLOR: 2, MODELO: 6, MODULO: 2 };
const seriesModeloSinLicencia = {
  'INDUMENTARIA|SIN DISCIPLINA': { prefijo: 'I', largoCorrelativo: 5, ultimoConfirmado: 326 },
  'INDUMENTARIA|FUTBOL': { prefijo: 'AF', largoCorrelativo: 4, ultimoConfirmado: 0 },
  'CALZADO|SIN DISCIPLINA': { prefijo: '135', largoCorrelativo: 3, ultimoConfirmado: 183 },
  'ACCESORIOS|SIN DISCIPLINA': { prefijo: '135', largoCorrelativo: 3, ultimoConfirmado: 183 },
  'ACCESORIOS|COLEGIAL': { prefijo: 'A', largoCorrelativo: 5, ultimoConfirmado: 1 },
  'POP|SIN DISCIPLINA': { prefijo: 'P', largoCorrelativo: 5, ultimoConfirmado: 1 }
};
const seriesModeloLicencia = [
  { aliases: ['SL', 'SAN LORENZO'], prefijo: 'SL', largoCorrelativo: 4, ultimoConfirmado: 189 },
  { aliases: ['TA', 'TALLERES'], prefijo: 'CAT', largoCorrelativo: 3, ultimoConfirmado: 76 },
  { aliases: ['VS', 'VELEZ', 'VELEZ SARSFIELD', 'VÉLEZ', 'VÉLEZ SARSFIELD'], prefijo: 'VS', largoCorrelativo: 4, ultimoConfirmado: 93 }
];
function normalizar(v) { return String(v ?? '').trim().toUpperCase(); }
function normalizarLicencia(v) { const valor = normalizar(v); return valor === '__SIN_LICENCIA__' ? 'SIN LICENCIA' : valor; }
function normalizarDisciplina(v) { const valor = normalizar(v); return !valor || valor === '__SIN_DISCIPLINA__' ? 'SIN DISCIPLINA' : valor; }
function validarCodigoProveedor(valor) {
  const codigo = normalizar(valor);
  if (!/^PB[A-Z0-9]{4}$/.test(codigo)) throw Object.assign(new Error('El proveedor debe tener un código con formato PBXXXX.'), { status: 400 });
  return codigo;
}
function codigoBase36(n, largo) { return n.toString(36).toUpperCase().padStart(largo, '0'); }

function sugerirPorMarcaYRubro(modelos, ocupados, marca, rubro) {
  const referencias = modelos
    .filter(x => normalizar(x.MARCA) === marca && normalizar(x.RUBRO) === rubro)
    .map(x => normalizar(x.CODIGO))
    .map(codigo => ({ codigo, partes: codigo.match(/^([A-Z]*)(\d+)$/) }))
    .filter(x => x.partes && x.codigo.length <= largos.MODELO);
  if (!referencias.length) throw Object.assign(new Error('No hay una numeración existente para esa marca y rubro.'), { status: 409 });

  const grupos = new Map();
  for (const referencia of referencias) {
    const prefijo = referencia.partes[1];
    const sufijo = referencia.partes[2];
    const grupo = grupos.get(prefijo) || { prefijo, cantidad: 0, mayor: -1, ancho: sufijo.length };
    grupo.cantidad += 1;
    grupo.mayor = Math.max(grupo.mayor, Number(sufijo));
    grupo.ancho = Math.max(grupo.ancho, sufijo.length);
    grupos.set(prefijo, grupo);
  }
  const serie = [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad || b.mayor - a.mayor)[0];
  for (let numero = serie.mayor + 1; numero < 10 ** serie.ancho; numero += 1) {
    const codigo = serie.prefijo + String(numero).padStart(serie.ancho, '0');
    if (codigo.length <= largos.MODELO && !ocupados.has(codigo)) return codigo;
  }
  throw Object.assign(new Error('No quedan códigos disponibles para esa marca y rubro.'), { status: 409 });
}

async function sugerirCodigo(idEmpresa, tipoEntrada) {
  const tipo = normalizar(tipoEntrada);
  const largo = largos[tipo];
  if (!largo) throw Object.assign(new Error('Tipo de maestro inválido.'), { status: 400 });
  const ocupados = new Set(await repository.codigosOcupados(idEmpresa, tipo));
  const limite = 36 ** largo;
  for (let i = 0; i < limite; i += 1) {
    const codigo = codigoBase36(i, largo);
    if (!ocupados.has(codigo)) return codigo;
  }
  throw Object.assign(new Error(`No quedan códigos disponibles para ${tipo}.`), { status: 409 });
}

async function listar(idEmpresa, usuario = 'SISTEMA') {
  await repository.conciliarModelosRegistrados(idEmpresa, usuario);
  return repository.listar(idEmpresa);
}

async function sugerirCodigoModelo(idEmpresa, filtros) {
  const marca = normalizar(filtros.marca);
  const rubro = normalizar(filtros.rubro);
  const licencia = normalizarLicencia(filtros.licencia);
  const disciplina = licencia === 'SIN LICENCIA' ? normalizarDisciplina(filtros.disciplina) : 'SIN DISCIPLINA';
  const nuevaLicencia = filtros.nuevaLicencia === true || normalizar(filtros.nuevaLicencia) === 'TRUE';
  const prefijoNuevo = normalizar(filtros.prefijo);
  const prefijoDisciplina = normalizar(filtros.prefijoDisciplina);
  if (!marca || !rubro || !licencia || !disciplina) throw Object.assign(new Error('Seleccione marca, rubro, licencia y disciplina antes de sugerir el modelo.'), { status: 400 });
  const modelos = await repository.listarModelosParaSugerencia(idEmpresa);
  const ocupados = new Set([...modelos.map(x => normalizar(x.CODIGO)), ...(filtros.ocupadosAdicionales || []).map(normalizar)]);
  if (marca !== 'ATOMIK') return sugerirPorMarcaYRubro(modelos, ocupados, marca, rubro);
  let prefijo;
  let largoCorrelativo = 4;
  let ultimoConfirmado = -1;
  let correlativoSoloNumerico = false;
  if (nuevaLicencia) {
    if (!/^[A-Z0-9]{2}$/.test(prefijoNuevo)) throw Object.assign(new Error('Para una licencia nueva indique sus 2 primeros caracteres.'), { status: 400 });
    if (modelos.some(x => normalizar(x.CODIGO).startsWith(prefijoNuevo))) throw Object.assign(new Error(`Los primeros caracteres ${prefijoNuevo} ya están utilizados por otra licencia.`), { status: 409 });
    prefijo = prefijoNuevo;
    correlativoSoloNumerico = true;
  } else {
    const mismaLicencia = modelos.filter(x => normalizar(x.LICENCIA || 'SIN LICENCIA') === licencia);
    if (licencia === 'SIN LICENCIA') {
      const serieConfirmada = marca === 'ATOMIK' ? seriesModeloSinLicencia[`${rubro}|${disciplina}`] : null;
      if (serieConfirmada) { ({ prefijo, largoCorrelativo, ultimoConfirmado } = serieConfirmada); correlativoSoloNumerico = true; }
      else if (marca === 'ATOMIK' && rubro === 'INDUMENTARIA' && disciplina !== 'SIN DISCIPLINA') {
        if (!/^[A-Z0-9]{2}$/.test(prefijoDisciplina)) throw Object.assign(new Error('Para esa disciplina indique los 2 caracteres de su numeración.'), { status: 400 });
        prefijo = prefijoDisciplina;
        largoCorrelativo = 4;
        correlativoSoloNumerico = true;
      }
      else {
        const referenciaRubro = mismaLicencia.filter(x => normalizar(x.MARCA) === marca && normalizar(x.RUBRO) === rubro);
        const series = referenciaRubro.map(x => normalizar(x.CODIGO).match(/^([A-Z])\d{5}$/)?.[1]).filter(Boolean);
        const codigosNumericos = referenciaRubro.map(x => normalizar(x.CODIGO)).filter(x => /^\d{6}$/.test(x));
        prefijo = [...new Set(series)].sort((a, b) => series.filter(x => x === b).length - series.filter(x => x === a).length)[0];
        if (prefijo && series.length >= codigosNumericos.length) largoCorrelativo = 5;
        else if (codigosNumericos.length) {
          const mayorNumerico = codigosNumericos.reduce((maximo, codigo) => Math.max(maximo, Number(codigo)), 0);
          for (let numero = mayorNumerico + 1; numero <= 999999; numero += 1) {
            const codigo = String(numero).padStart(6, '0');
            if (!ocupados.has(codigo)) return codigo;
          }
          throw Object.assign(new Error('No quedan códigos disponibles para esa marca y rubro sin licencia.'), { status: 409 });
        } else throw Object.assign(new Error('No hay una numeración habilitada para esa marca y rubro sin licencia.'), { status: 409 });
      }
    } else {
      const serieConfirmada = marca === 'ATOMIK' ? seriesModeloLicencia.find(x => x.aliases.includes(licencia)) : null;
      if (serieConfirmada) { ({ prefijo, largoCorrelativo, ultimoConfirmado } = serieConfirmada); correlativoSoloNumerico = true; }
      else {
        const candidatos = mismaLicencia.filter(x => normalizar(x.MARCA) === marca);
        const referencia = candidatos.length ? candidatos : mismaLicencia;
        const prefijosValidos = referencia.map(x => normalizar(x.CODIGO).slice(0, 2)).filter(x => /^[A-Z]{2}$/.test(x));
        prefijo = prefijosValidos.sort((a, b) => prefijosValidos.filter(x => x === b).length - prefijosValidos.filter(x => x === a).length)[0];
        if (!prefijo) throw Object.assign(new Error('No se encontró la serie de dos letras de esa licencia. Regístrela como licencia nueva.'), { status: 409 });
      }
    }
  }
  const patron = new RegExp(`^${prefijo}(${correlativoSoloNumerico ? '\\d' : '[A-Z0-9]'}{${largoCorrelativo}})$`);
  const sufijos = [...ocupados].map(codigo => codigo.match(patron)?.[1]).filter(Boolean);
  const baseCorrelativo = !correlativoSoloNumerico && sufijos.some(sufijo => /[A-Z]/.test(sufijo)) ? 36 : 10;
  const mayor = sufijos.reduce((maximo, sufijo) => Math.max(maximo, Number.parseInt(sufijo, baseCorrelativo)), ultimoConfirmado);
  for (let numero = Math.max(0, mayor + 1); numero < baseCorrelativo ** largoCorrelativo; numero += 1) {
    const sufijo = baseCorrelativo === 36 ? codigoBase36(numero, largoCorrelativo) : String(numero).padStart(largoCorrelativo, '0');
    const codigo = prefijo + sufijo;
    if (!ocupados.has(codigo)) return codigo;
  }
  throw Object.assign(new Error('No quedan códigos disponibles para esa licencia.'), { status: 409 });
}

async function crear({ idEmpresa, usuario, cuerpo }) {
  const tipo = normalizar(cuerpo.tipo);
  const nombre = normalizar(cuerpo.nombre);
  const licenciaModelo = normalizarLicencia(cuerpo.licencia);
  const disciplinaModelo = licenciaModelo === 'SIN LICENCIA' ? normalizarDisciplina(cuerpo.disciplina) : 'SIN DISCIPLINA';
  const codigo = normalizar(cuerpo.codigo) || await sugerirCodigo(idEmpresa, tipo);
  if (!largos[tipo] || !nombre) throw Object.assign(new Error('Debe indicar tipo y nombre.'), { status: 400 });
  const largoValido = tipo === 'MODELO' ? codigo.length >= 1 && codigo.length <= largos[tipo] : codigo.length === largos[tipo];
  if (!/^[A-Z0-9]+$/.test(codigo) || !largoValido) {
    throw Object.assign(new Error(`El código de ${tipo} debe tener hasta ${largos[tipo]} caracteres alfanuméricos.`), { status: 400 });
  }
  if (tipo === 'MODELO' && (!normalizar(cuerpo.marca) || !normalizar(cuerpo.rubro) || !licenciaModelo || !disciplinaModelo || !normalizar(cuerpo.cProveedor))) {
    throw Object.assign(new Error('Para un modelo debe indicar marca, rubro, licencia, disciplina y proveedor.'), { status: 400 });
  }
  const cProveedor = tipo === 'MODELO' ? validarCodigoProveedor(cuerpo.cProveedor) : normalizar(cuerpo.cProveedor);
  const datos = tipo === 'MODELO' ? { ...(cuerpo.datos || {}), disciplina: disciplinaModelo, prefijoDisciplina: normalizar(cuerpo.prefijoDisciplina) || null } : cuerpo.datos;
  return repository.crear({ idEmpresa, tipo, codigo, nombre, cProveedor, licencia: licenciaModelo, marca: normalizar(cuerpo.marca), rubro: normalizar(cuerpo.rubro), datosJson: datos ? JSON.stringify(datos) : null, usuario: usuario || 'SISTEMA' });
}

function claveColumna(valor) { return normalizar(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function valorFila(fila, nombres) { const entradas = Object.entries(fila || {}).map(([k, v]) => [claveColumna(k), v]); for (const nombre of nombres) { const encontrado = entradas.find(([k]) => k === nombre); if (encontrado) return normalizar(encontrado[1]); } return ''; }

async function previsualizarModelos({ idEmpresa, buffer, contexto = {}, proveedores = null }) {
  let libro;
  try { libro = XLSX.read(buffer, { type: 'buffer' }); }
  catch { throw Object.assign(new Error('El archivo no es un Excel válido.'), { status: 400 }); }
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const origen = hoja ? XLSX.utils.sheet_to_json(hoja, { defval: '' }) : [];
  if (!origen.length) throw Object.assign(new Error('El template no contiene modelos para procesar.'), { status: 400 });
  if (origen.length > 500) throw Object.assign(new Error('El template admite hasta 500 modelos por carga.'), { status: 400 });
  const ocupadosLote = [];
  const filas = [];
  const catalogoProveedores = proveedores || await maestrosRepository.buscarProveedores({ idEmpresa });
  const proveedoresPorNombre = new Map();
  for (const proveedor of catalogoProveedores) {
    const codigo = normalizar(proveedor.CODIGO);
    const nombre = normalizar(proveedor.NVA_RAZON_SOCIAL);
    if (!nombre || !/^PB[A-Z0-9]{4}$/.test(codigo)) continue;
    const coincidencias = proveedoresPorNombre.get(nombre) || [];
    coincidencias.push({ codigo, nombre: String(proveedor.NVA_RAZON_SOCIAL).trim() });
    proveedoresPorNombre.set(nombre, coincidencias);
  }
  const datosComunes = {
    marca: normalizar(contexto.marca),
    rubro: normalizar(contexto.rubro),
    licencia: normalizarLicencia(contexto.licencia) || 'SIN LICENCIA',
    prefijo: normalizar(contexto.prefijo),
    disciplina: normalizarLicencia(contexto.licencia) === 'SIN LICENCIA' ? normalizarDisciplina(contexto.disciplina) : 'SIN DISCIPLINA',
    prefijoDisciplina: normalizar(contexto.prefijoDisciplina)
  };
  if (!datosComunes.marca || !datosComunes.rubro || !datosComunes.licencia || !datosComunes.disciplina) throw Object.assign(new Error('Seleccione marca, rubro, licencia y disciplina antes de procesar el template.'), { status: 400 });
  for (let indice = 0; indice < origen.length; indice += 1) {
    const fila = origen[indice];
    const datos = {
      fila: indice + 2,
      nombre: valorFila(fila, ['NOMBRE_MODELO', 'NOMBRE', 'DESCRIPCION', 'MODELO']),
      proveedorNombre: valorFila(fila, ['PROVEEDOR', 'NOMBRE_PROVEEDOR']),
      ...datosComunes
    };
    try {
      if (!datos.nombre) throw Object.assign(new Error('Complete el nombre del modelo.'), { status: 400 });
      if (!datos.proveedorNombre) throw Object.assign(new Error('Seleccione el proveedor de la fila.'), { status: 400 });
      const coincidenciasProveedor = proveedoresPorNombre.get(datos.proveedorNombre) || [];
      if (!coincidenciasProveedor.length) throw Object.assign(new Error('El proveedor no coincide con el nombre exacto del maestro.'), { status: 400 });
      if (coincidenciasProveedor.length > 1) throw Object.assign(new Error('El nombre del proveedor está duplicado en el maestro y no permite determinar su código.'), { status: 409 });
      datos.proveedorNombre = coincidenciasProveedor[0].nombre;
      datos.cProveedor = validarCodigoProveedor(coincidenciasProveedor[0].codigo);
      const nuevaLicencia = Boolean(datos.prefijo);
      datos.codigo = await sugerirCodigoModelo(idEmpresa, { ...datos, nuevaLicencia, ocupadosAdicionales: ocupadosLote });
      datos.estado = 'LISTO';
      datos.error = '';
      ocupadosLote.push(datos.codigo);
    } catch (e) {
      datos.codigo = '';
      datos.estado = 'REVISAR';
      datos.error = e.message;
    }
    filas.push(datos);
  }
  return { filas, total: filas.length, listos: filas.filter(x => x.estado === 'LISTO').length };
}

async function generarTemplateModelos(idEmpresa) {
  const proveedores = (await maestrosRepository.buscarProveedores({ idEmpresa }))
    .map(x => ({ codigo: normalizar(x.CODIGO), nombre: String(x.NVA_RAZON_SOCIAL || '').trim() }))
    .filter(x => x.nombre && /^PB[A-Z0-9]{4}$/.test(x.codigo));
  if (!proveedores.length) throw Object.assign(new Error('No hay proveedores con código PBXXXX disponibles para generar el template.'), { status: 409 });
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Productos App';
  const hoja = libro.addWorksheet('Modelos');
  hoja.columns = [{ header: 'NOMBRE_MODELO', key: 'nombre', width: 42 }, { header: 'PROVEEDOR', key: 'proveedor', width: 18 }];
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  const catalogo = libro.addWorksheet('Proveedores');
  catalogo.columns = [{ header: 'NOMBRE', key: 'nombre', width: 48 }, { header: 'CODIGO', key: 'codigo', width: 14 }];
  proveedores.forEach(x => catalogo.addRow(x));
  catalogo.state = 'veryHidden';
  const ultimaFila = proveedores.length + 1;
  for (let fila = 2; fila <= 501; fila += 1) {
    hoja.getCell(`B${fila}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Proveedores!$A$2:$A$${ultimaFila}`], showErrorMessage: true, errorTitle: 'Proveedor inválido', error: 'Seleccione el nombre exacto del proveedor.' };
  }
  return libro.xlsx.writeBuffer();
}

async function crearModelosMasivos({ idEmpresa, usuario, filas }) {
  if (!Array.isArray(filas) || !filas.length) throw Object.assign(new Error('No hay modelos para guardar.'), { status: 400 });
  if (filas.some(x => x.estado !== 'LISTO' || !x.codigo)) throw Object.assign(new Error('Hay filas pendientes de revisión.'), { status: 400 });
  const catalogoProveedores = await maestrosRepository.buscarProveedores({ idEmpresa });
  for (const fila of filas) {
    const coincide = catalogoProveedores.some(proveedor =>
      normalizar(proveedor.NVA_RAZON_SOCIAL) === normalizar(fila.proveedorNombre) &&
      normalizar(proveedor.CODIGO) === normalizar(fila.cProveedor) &&
      /^PB[A-Z0-9]{4}$/.test(normalizar(proveedor.CODIGO))
    );
    if (!coincide) throw Object.assign(new Error(`El proveedor de la fila ${fila.fila || '-'} cambió o ya no coincide con el maestro.`), { status: 409 });
  }
  const ocupadosLote = [];
  for (const fila of filas) {
    const codigoEsperado = await sugerirCodigoModelo(idEmpresa, { ...fila, nuevaLicencia: Boolean(fila.prefijo), ocupadosAdicionales: ocupadosLote });
    if (normalizar(fila.codigo) !== codigoEsperado) throw Object.assign(new Error(`El código de la fila ${fila.fila || '-'} cambió. Procese nuevamente el template.`), { status: 409 });
    ocupadosLote.push(codigoEsperado);
  }
  const registros = [];
  for (const fila of filas) registros.push(await crear({ idEmpresa, usuario, cuerpo: { tipo: 'MODELO', codigo: fila.codigo, nombre: fila.nombre, cProveedor: fila.cProveedor, licencia: fila.licencia, marca: fila.marca, rubro: fila.rubro, disciplina: fila.disciplina, prefijoDisciplina: fila.prefijoDisciplina } }));
  return registros;
}

function generarExcelVistaPreviaModelos(filas) {
  if (!Array.isArray(filas) || !filas.length) throw Object.assign(new Error('No hay una vista previa para descargar.'), { status: 400 });
  const datos = filas.map(fila => ({
    FILA_ORIGINAL: fila.fila || '',
    CODIGO_ASIGNADO: normalizar(fila.codigo),
    NOMBRE_MODELO: normalizar(fila.nombre),
    MARCA: normalizar(fila.marca),
    RUBRO: normalizar(fila.rubro),
    LICENCIA: normalizarLicencia(fila.licencia),
    DISCIPLINA: normalizarDisciplina(fila.disciplina),
    PROVEEDOR: String(fila.proveedorNombre || '').trim(),
    CODIGO_PROVEEDOR: normalizar(fila.cProveedor),
    ESTADO: normalizar(fila.estado),
    OBSERVACION: String(fila.error || '').trim()
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja['!cols'] = [
    { wch: 14 }, { wch: 18 }, { wch: 42 }, { wch: 18 }, { wch: 18 },
    { wch: 24 }, { wch: 38 }, { wch: 18 }, { wch: 12 }, { wch: 48 }
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Modelos asignados');
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}

const definicionesDbi = {
  COLOR: { archivo: 'TBL_COLORES.DBI', campos: [{ nombre: 'CODIGO', tipo: 'C', largo: 2 }, { nombre: 'DET_COLOR', tipo: 'C', largo: 30 }], map: x => ({ CODIGO: x.CODIGO, DET_COLOR: x.NOMBRE }) },
  MODELO: {
    archivo: 'TBL_MODELOS.DBI',
    campos: [
      { nombre: 'COD_MODELO', tipo: 'C', largo: 6 },
      { nombre: 'MODELO', tipo: 'C', largo: 50 },
      { nombre: 'C_PROVEEDO', tipo: 'C', largo: 6 },
      { nombre: 'LICENCIA', tipo: 'C', largo: 20 },
      { nombre: 'MARCA', tipo: 'C', largo: 20 },
      { nombre: 'RUBRO', tipo: 'C', largo: 20 }
    ],
    map: x => ({
      COD_MODELO: x.CODIGO,
      MODELO: x.NOMBRE,
      C_PROVEEDO: validarCodigoProveedor(x.C_PROVEEDO),
      LICENCIA: normalizarLicencia(x.LICENCIA) === 'SIN LICENCIA' ? '' : normalizar(x.LICENCIA),
      MARCA: x.MARCA,
      RUBRO: x.RUBRO
    })
  }
};

async function enviarPresea({ idEmpresa, usuario }) {
  const datos = await repository.obtenerPendientesYConfiguracion(idEmpresa);
  const rutaDestino = resolverRutaDestinoMaestros(datos.rutaDestino);
  if (!rutaDestino) throw Object.assign(new Error('La empresa no tiene configurada la carpeta FTP de Altas de Maestros.'), { status: 409 });
  const noSoportados = datos.registros.filter(x => x.TIPO === 'MODULO');
  if (noSoportados.length) throw Object.assign(new Error('Hay módulos pendientes: primero debe completarse su distribución de talles.'), { status: 409 });
  if (!datos.registros.length) throw Object.assign(new Error('No hay solicitudes pendientes para enviar.'), { status: 409 });
  const carpetaLocal = path.join(process.env.EXPORT_PATH || path.join(process.cwd(), 'salidas'), 'altas-maestros', String(idEmpresa));
  fs.mkdirSync(carpetaLocal, { recursive: true });
  const archivos = [];
  for (const tipo of ['COLOR', 'MODELO']) {
    const filas = datos.registros.filter(x => x.TIPO === tipo);
    if (!filas.length) continue;
    const def = definicionesDbi[tipo];
    const destinoLocal = path.join(carpetaLocal, def.archivo);
    escribirDBFGenerico(destinoLocal, filas.map(def.map), def.campos);
    const resultadoFTP = await ftpService.subirArchivo(destinoLocal, def.archivo, def.archivo, rutaDestino);
    archivos.push({ nombre: def.archivo, registros: filas.length, ruta: resultadoFTP.rutaRemota || `${rutaDestino}/${def.archivo}` });
  }
  await repository.marcarEnviados(idEmpresa, datos.registros.map(x => x.ID_ALTA_MAESTRO), archivos, usuario || 'SISTEMA');
  return { archivos, registros: datos.registros.length, rutaDestino };
}

module.exports = { listar, sugerirCodigo, sugerirCodigoModelo, sugerirPorMarcaYRubro, crear, previsualizarModelos, crearModelosMasivos, generarTemplateModelos, generarExcelVistaPreviaModelos, codigoBase36, enviarPresea, definicionesDbi, resolverRutaDestinoMaestros };
