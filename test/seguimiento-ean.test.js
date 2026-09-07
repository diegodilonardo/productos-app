const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');

const seguimientoService = require('../src/services/seguimiento.service');
const seguimientoRepository = require('../src/repositories/seguimiento.repository');
const imagenesAltaService = require('../src/services/imagenesAlta.service');

const accesoTotal = {
  todasMarcas: true,
  todosRubros: true,
  todasLicencias: true,
};

test('clasifica el EAN provisorio como pendiente de gestión en GS1', () => {
  assert.equal(seguimientoService.estadoSeguimientoEan('7792800015157'), 'PENDIENTE_GS1');
  assert.equal(seguimientoService.estadoSeguimientoEan('7791234567890'), 'EAN_ASIGNADO');
  assert.equal(seguimientoService.estadoSeguimientoEan(''), 'SIN_EAN');
});

test('valida el dígito verificador de un EAN13', () => {
  assert.equal(seguimientoService.ean13Valido('7792800716269'), true);
  assert.equal(seguimientoService.ean13Valido('7792800716268'), false);
});

test('genera GTIN.DBI con CODIGO entero y GTIN de texto', async () => {
  const original = seguimientoRepository.listarProductosSeguimientoEan;
  seguimientoRepository.listarProductosSeguimientoEan = async () => [{
    ID_ALTA: 1, COD_ALFA: 'A', CODIGO_ERP: '888889000071658', EAN_GS1: '7792800716269',
    EAN_ERP: '7792800015157', TIPO_PRODUCTO_DETALLE: 'MODULO', GENERADO_AUTOMATICO: false,
  }];
  try {
    const buffer = await seguimientoService.exportarGtinDbi(['1|A'], { idEmpresa: 1, acceso: accesoTotal });
    assert.equal(buffer.readUInt32LE(4), 1);
    assert.equal(buffer.readUInt16LE(8), 97);
    assert.equal(buffer.readUInt16LE(10), 275);
    assert.equal(buffer[32 + 17], 0);
    const registro = buffer.subarray(97, 372);
    assert.equal(registro.subarray(1, 21).toString('ascii').trim(), '888889000071658');
    assert.equal(registro.subarray(21).toString('ascii').trim(), '7792800716269');
  } finally { seguimientoRepository.listarProductosSeguimientoEan = original; }
});

test('resume productos confirmados según el estado de su EAN', async () => {
  const original = seguimientoRepository.listarProductosSeguimientoEan;
  seguimientoRepository.listarProductosSeguimientoEan = async () => [
    { ID_ALTA: 1, COD_ALFA: 'A', EAN_ERP: '7792800015157', TIPO_PRODUCTO_DETALLE: 'MODULO', DETALLE_MODULO: '36-40', GENERADO_AUTOMATICO: false },
    { ID_ALTA: 1, COD_ALFA: 'B', EAN_ERP: '7791234567890', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA', DETALLE_TALLE: '38', FAMILIAS_MODULO: 'A' },
    { ID_ALTA: 1, COD_ALFA: 'C', EAN_ERP: null, TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA', DETALLE_TALLE: '39' },
    { ID_ALTA: 1, COD_ALFA: 'D', EAN_ERP: '7792800015157', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'SEGUNDA', DETALLE_TALLE: '39' },
  ];

  try {
    const resultado = await seguimientoService.listarSeguimientoEan({ idEmpresa: 1, acceso: accesoTotal });
    assert.deepEqual(resultado.resumen, {
      total: 3,
      pendientesGs1: 1,
      asignados: 1,
      sinEan: 1,
      urlsAsociadas: 0,
      pendientesErp: 0,
      confirmadosErp: 0,
    });
    assert.equal(resultado.productos[0].TALLE_CURVA, '36-40');
    assert.equal(resultado.productos[1].TALLE_CURVA, '38');
    assert.equal(resultado.productos.some(x => x.COD_ALFA === 'D'), false);
    assert.equal(resultado.grupos.length, 2);
    assert.equal(resultado.grupos[0].tipo, 'MODULO');
    assert.equal(resultado.grupos[0].primeras.length, 1);
    assert.equal(resultado.grupos[1].tipo, 'PRIMERA');
  } finally {
    seguimientoRepository.listarProductosSeguimientoEan = original;
  }
});

test('la consulta EAN se limita a confirmados ERP, empresa y Altas no anuladas', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '../src/repositories/seguimiento.repository.js'),
    'utf8'
  );
  assert.match(fuente, /E\.ESTADO_ERP = 'GENERADO_OK_EN_ERP'/);
  assert.match(fuente, /E\.ID_EMPRESA = @ID_EMPRESA/);
  assert.match(fuente, /ISNULL\(A\.ESTADO, ''\) <> 'ANULADO'/);
  assert.match(fuente, /D\.DETALLE_CLASIFICACION[\s\S]*= 'PRIMERA'/);
  assert.match(fuente, /D\.TIPO_PRODUCTO_DETALLE[\s\S]*= 'MODULO'/);
  assert.match(fuente, /MP\.ID_EMPRESA = X\.ID_EMPRESA/);
  assert.match(fuente, /MP\.CODIGO_PAIS = X\.CODIGO_PAIS/);
  assert.match(fuente, /MP\.PAIS_EAN/);
  assert.match(fuente, /GS1_PRODUCTOS_URLS/);
  assert.match(fuente, /G\.URL_IMAGEN AS URL_IMAGEN_GS1/);
});

test('la consulta EAN incorpora productos existentes de Altas sin novedades ERP', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '../src/repositories/seguimiento.repository.js'),
    'utf8'
  );
  assert.match(fuente, /A0\.ESTADO = 'SIN_NOVEDADES_ERP'/);
  assert.match(fuente, /INNER JOIN dbo\.PRODUCTOS PR/);
  assert.match(fuente, /E\.ESTADO_ERP IN \('GENERADO_OK_EN_ERP', 'SIN_NOVEDADES_ERP'\)/);
  assert.match(fuente, /NOT EXISTS[\s\S]*?ALTAS_PRODUCTOS_EXPORTADOS EX0/);
});

test('la migración registra una URL única por empresa, Alta y producto', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../sql/16_registrar_urls_productos_gs1.sql'),
    'utf8'
  );
  assert.match(sql, /UNIQUE \(ID_EMPRESA, ID_ALTA, COD_ALFA\)/);
  assert.match(sql, /URL_IMAGEN VARCHAR\(2000\) NOT NULL/);
  assert.match(sql, /USUARIO_CREACION/);
  assert.match(sql, /FECHA_ACTUALIZACION/);
});

test('la importación final crea la URL de GS1 aunque el producto no tuviera una asociación previa', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '../src/repositories/seguimiento.repository.js'),
    'utf8'
  );
  assert.match(fuente, /MERGE dbo\.GS1_PRODUCTOS_URLS WITH \(HOLDLOCK\)/);
  assert.match(fuente, /WHEN NOT MATCHED THEN INSERT[\s\S]*NOMBRE_IMAGEN,URL_IMAGEN/);
});

test('las URLs temporales pueden asociarse mientras el EAN todavía no fue enviado a Presea', () => {
  const servicio = fs.readFileSync(
    path.join(__dirname, '../src/services/seguimiento.service.js'),
    'utf8'
  );
  const frontend = fs.readFileSync(
    path.join(__dirname, '../public/js/seguimiento.js'),
    'utf8'
  );
  assert.match(servicio, /new Set\(\['PENDIENTE_GS1', 'EAN_ASIGNADO'\]\)/);
  assert.match(frontend, /productosSeleccionadosEan\('PENDIENTE_GS1', 'EAN_ASIGNADO'\)[\s\S]*?URL_IMAGEN_GS1/);
});

test('la migración EAN incorpora el seguimiento del envío a Presea', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/17_registrar_codigos_ean_gs1.sql'), 'utf8');
  assert.match(sql, /FECHA_ENVIO_PRESEA/);
  assert.match(sql, /USUARIO_ENVIO_PRESEA/);
});

test('la pantalla ofrece seguimiento EAN, filtros y descarga GS1', () => {
  const vista = fs.readFileSync(
    path.join(__dirname, '../views/seguimiento/index.hbs'),
    'utf8'
  );
  assert.match(vista, /Seguimiento EAN \/ GS1/);
  assert.match(vista, /id="buscarSeguimientoEan"/);
  assert.match(vista, /id="filtroEstadoEan"/);
  assert.match(vista, /id="filtroTemporadaEan"/);
  assert.match(vista, /id="filtroAnoEan"/);
  assert.match(vista, /id="filtroRubroEan"/);
  assert.match(vista, /id="paginacionSeguimientoEan"/);
  assert.match(vista, /id="listadoProductosEan"/);
  assert.match(vista, /seguimiento-ean-action-group/);
  assert.match(vista, /pendientes\.xlsx/);
  assert.match(vista, /btnDescargarImagenesEan/);
  assert.match(vista, /btnImportarUrlsTemporalesEan/);
  assert.match(vista, /archivoUrlsTemporalesEan/);
  assert.match(vista, /btnGenerarArchivoGs1/);
  assert.match(vista, /btnExportarGtinDbi/);
  assert.match(vista, /btnEnviarGtinPresea/);
  assert.match(vista, /id="eanPendientesErp"/);
  assert.match(vista, /id="eanConfirmadosErp"/);
  assert.match(vista, /seleccionarTodosEan/);
  const frontend = fs.readFileSync(
    path.join(__dirname, '../public/js/seguimiento.js'),
    'utf8'
  );
  assert.match(frontend, /URL GS1 ASOCIADA/);
  assert.match(frontend, /GESTIONAR EN GS1/);
  assert.match(frontend, /PRODUCTOS_POR_PAGINA_EAN = 50/);
  assert.match(frontend, /paginarGruposSeguimientoEan/);
  assert.match(frontend, /poblarFiltrosSeguimientoEan/);
  assert.match(frontend, /getElementById\('listadoProductosEan'\)\?\.scrollIntoView/);
  assert.match(frontend, /productosSeleccionadosEan\('PENDIENTE_GS1'\)/);
  assert.match(frontend, /productosSeleccionadosEan\('EAN_ASIGNADO'\)/);
  assert.match(frontend, /productosSeleccionadosEan\('CONFIRMADO_ERP'\)/);
  assert.match(frontend, /seguimiento\.ean\.seleccion\.\$\{idEmpresaSeguimiento\}/);
  assert.match(frontend, /guardarSeleccionEan\(\)/);
  assert.match(frontend, /checkbox\.indeterminate = seleccionadas > 0/);
  assert.match(frontend, /seleccionEan\.size\} seleccionados/);
  assert.match(frontend, /clavesEanVisibles = \[\.\.\.new Set\(grupos\.flatMap/);
  assert.doesNotMatch(frontend, /clavesEanVisibles = \[\.\.\.new Set\(gruposPagina\.flatMap/);
  assert.match(frontend, /gruposSeguimientoEan\.flatMap\(grupo => \[grupo\.principal, \.\.\.\(grupo\.primeras \|\| \[\]\)\]\)/);
  assert.match(frontend, /producto\.URL_IMAGEN_GS1 = asociacion\.urlImagen;[\s\S]*?pintarSeguimientoEan\(\);/);
  assert.match(frontend, /clavesProducto: clavesConfirmadas/);
  assert.match(frontend, /clavesProducto:clavesImportables/);
  assert.match(frontend, /productosSeleccionadosEan\('PENDIENTE_GS1', 'EAN_ASIGNADO'\)/);
  assert.match(frontend, /ignoradosYaActualizados/);
  assert.match(frontend, /mostrarToastSeguimiento\(`GTIN\.DBI enviado correctamente a Presea/);
  assert.match(frontend, /await cargarTodo\(\);/);
});

test('la importación EAN cruza solo la selección pendiente e ignora registros históricos del día', async () => {
  const listarOriginal = seguimientoRepository.listarProductosSeguimientoEan;
  const guardarOriginal = seguimientoRepository.guardarCodigosEanGs1;
  seguimientoRepository.listarProductosSeguimientoEan = async () => [
    { ID_ALTA: 10, COD_ALFA: 'PEND-1', EAN_ERP: '7792800015157', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA' },
    { ID_ALTA: 10, COD_ALFA: 'PEND-2', EAN_ERP: '7792800015157', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA' },
    { ID_ALTA: 10, COD_ALFA: 'REIMPORTAR', EAN_ERP: '7792800015157', EAN_GS1: '7792800716641', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA' },
    { ID_ALTA: 9, COD_ALFA: 'ANTERIOR', EAN_ERP: '7792800716276', EAN_GS1: '7792800716276', FECHA_ENVIO_PRESEA: '2026-09-06', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA' },
    { ID_ALTA: 11, COD_ALFA: 'NO-SELECCIONADO', EAN_ERP: '7792800015157', TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA' },
  ];
  let guardados = [];
  seguimientoRepository.guardarCodigosEanGs1 = async datos => {
    guardados = datos.productos;
    return { insertados: datos.productos.length, actualizados: 0 };
  };
  const XLSX = require('xlsx');
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet([
    { GTIN: '7792800716689', CodigoInterno: 'PEND-1' },
    { GTIN: '7792800716672', CodigoInterno: 'PEND-2' },
    { GTIN: '7792800716658', CodigoInterno: 'REIMPORTAR' },
    { GTIN: '7792800716276', CodigoInterno: 'ANTERIOR' },
    { GTIN: '7792800716665', CodigoInterno: 'NO-SELECCIONADO' },
  ]);
  XLSX.utils.book_append_sheet(libro, hoja, 'Datos_Productos');

  try {
    const resultado = await seguimientoService.importarCodigosEanGs1(
      XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }),
      'Datos.xlsx',
      ['10|PEND-1', '10|PEND-2', '10|REIMPORTAR'],
      { idEmpresa: 1, acceso: accesoTotal }
    );
    assert.deepEqual(guardados.map(item => item.codigoAlfa), ['PEND-1', 'PEND-2', 'REIMPORTAR']);
    assert.equal(resultado.resumen.validos, 3);
    assert.equal(resultado.resumen.ignoradosYaActualizados, 1);
    assert.equal(resultado.resumen.ignoradosFueraSeleccion, 1);
  } finally {
    seguimientoRepository.listarProductosSeguimientoEan = listarOriginal;
    seguimientoRepository.guardarCodigosEanGs1 = guardarOriginal;
  }
});

test('la fila GS1 repite la marca como submarca y aplica la matriz comercial', () => {
  const fila = seguimientoService.filaArchivoGs1({
    COD_ALFA: 'ABC', DETALLE_MARCA: 'ATOMIK', DETALLE_RUBRO: 'INDUMENTARIA',
    TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', PAIS_EAN: '032',
    DETALLE_MODELO: 'CAMPERA', DETALLE_PRODUCTO: 'CAMPERA NEGRA', PARES: 1,
    DETALLE_EDAD: 'ADULTO',
    CODIGO_TEMPORADA: '1', DETALLE_TEMPORADA: 'VE', CODIGO_ANO: '27',
  }, 'https://gs1.example/imagen.jpg');
  assert.equal(fila.length, 42);
  assert.equal(fila[1], 'ATOMIK');
  assert.equal(fila[2], 'ATOMIK');
  assert.equal(fila[4], 'CAMPERA NEGRA ADULTO VE 27');
  assert.equal(fila[5], '10001342');
  assert.equal(fila[6], '032');
  assert.equal(fila[8], 'EC');
  assert.equal(fila[10], 'UN');
  assert.equal(fila[21], 'https://gs1.example/imagen.jpg');
});

test('el archivo GS1 diferencia variedades duplicadas por sexo', () => {
  const base = {
    ID_ALTA: 1, DETALLE_MARCA: 'ATOMIK', DETALLE_RUBRO: 'CALZADO',
    TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', PAIS_EAN: '032',
    DETALLE_MODELO: 'THUNDER', DETALLE_PRODUCTO: 'THUNDER NEGRO PRIMERA 40',
    DETALLE_EDAD: 'ADULTO', DETALLE_TEMPORADA: 'VE', CODIGO_ANO: '27', PARES: 1,
  };
  const productos = [
    { ...base, COD_ALFA: 'COD-UNI', SEXO: 'UNI' },
    { ...base, COD_ALFA: 'COD-MAS', SEXO: 'MAS' },
  ];
  const urls = new Map([
    ['1|COD-UNI', 'https://gs1.example/uni.jpg'],
    ['1|COD-MAS', 'https://gs1.example/mas.jpg'],
  ]);
  const filas = seguimientoService.asegurarVariedadesUnicas(productos, urls);
  assert.equal(new Set(filas.map(fila => fila[4])).size, 2);
  assert.match(filas[0][4], /ADULTO UNI VE 27$/);
  assert.match(filas[1][4], /ADULTO MAS VE 27$/);
});

test('asocia las URLs temporales de GS1 por el nombre real de la imagen', async () => {
  const listarOriginal = seguimientoRepository.listarProductosSeguimientoEan;
  const imagenOriginal = imagenesAltaService.buscarImagenProducto;
  const guardarOriginal = seguimientoRepository.guardarUrlsProductosGs1;
  seguimientoRepository.listarProductosSeguimientoEan = async () => [{
    ID_ALTA: 9, COD_ALFA: 'ABC', EAN_ERP: '7792800015157',
    TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA',
    CODIGO_MODELO: '123', CODIGO_COLOR: '10'
  }];
  imagenesAltaService.buscarImagenProducto = async () => ({ nombre: 'Producto ABC.jpg' });
  seguimientoRepository.guardarUrlsProductosGs1 = async datos => ({
    insertadas: datos.asociaciones.length,
    actualizadas: 0,
  });
  const workbook = new (require('exceljs')).Workbook();
  const hoja = workbook.addWorksheet('Urls_Temporales');
  hoja.addRow(['Urls', 'Nombre']);
  // GS1 devuelve el nombre base sin la extensión original de la imagen.
  hoja.addRow(['https://gs1.example/temporal/abc', 'Producto ABC']);
  try {
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const resultado = await seguimientoService.asociarUrlsTemporalesEan(
      buffer, ['9|ABC'], { idEmpresa: 1, acceso: accesoTotal }
    );
    assert.equal(resultado.resumen.productosAsociados, 1);
    assert.equal(resultado.resumen.urlsInsertadas, 1);
    assert.equal(resultado.asociados[0].urlImagen, 'https://gs1.example/temporal/abc');
  } finally {
    seguimientoRepository.listarProductosSeguimientoEan = listarOriginal;
    imagenesAltaService.buscarImagenProducto = imagenOriginal;
    seguimientoRepository.guardarUrlsProductosGs1 = guardarOriginal;
  }
});

test('la descarga seleccionada entrega imágenes de al menos 400 por 400', async () => {
  const listarOriginal = seguimientoRepository.listarProductosSeguimientoEan;
  const imagenOriginal = imagenesAltaService.buscarImagenProducto;
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'ean-img-'));
  const archivo = path.join(carpeta, 'producto.jpg');
  await sharp({ create: { width: 120, height: 200, channels: 3, background: '#ffffff' } })
    .jpeg().toFile(archivo);
  seguimientoRepository.listarProductosSeguimientoEan = async () => [{
    ID_ALTA: 9, COD_ALFA: 'ABC', EAN_ERP: '7792800015157',
    TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO', DETALLE_CLASIFICACION: 'PRIMERA',
    CODIGO_MODELO: '123', CODIGO_COLOR: '10'
  }];
  imagenesAltaService.buscarImagenProducto = async () => ({
    archivo, nombre: 'producto.jpg', extension: '.jpg'
  });
  try {
    const resultado = await seguimientoService.prepararImagenesEan(
      ['9|ABC'], { idEmpresa: 1, acceso: accesoTotal }
    );
    assert.equal(resultado.imagenes.length, 1);
    assert.equal(resultado.imagenes[0].nombre, 'producto.jpg');
    const metadata = await sharp(resultado.imagenes[0].buffer).metadata();
    assert.ok(metadata.width >= 400);
    assert.ok(metadata.height >= 400);
  } finally {
    seguimientoRepository.listarProductosSeguimientoEan = listarOriginal;
    imagenesAltaService.buscarImagenProducto = imagenOriginal;
    try { fs.rmSync(carpeta, { recursive: true, force: true }); } catch (_) {}
  }
});
