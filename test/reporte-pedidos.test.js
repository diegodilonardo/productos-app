const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const repository = require('../src/repositories/pedidos.repository');
const service = require('../src/services/pedidos.service');
const authMiddleware = require('../src/middlewares/auth.middleware');

test('el reporte filtra borradores, validados o ambos y conserva las monedas separadas', async () => {
  const original = repository.listarPedidos;
  const altasOriginal = repository.obtenerAltasPorPedido;
  repository.listarPedidos = async () => [
    { ID_PEDIDO:1, ESTADO:'VALIDADO', CODIGO_PROVEEDOR:'PB001', CODIGO_RUBRO:'1', CODIGO_TEMPORADA:'VE', CODIGO_ANO:'27', TOTAL_PARES:12, TOTAL_PEDIDO:100, MONEDA:'USD' },
    { ID_PEDIDO:2, ESTADO:'BORRADOR', CODIGO_PROVEEDOR:'PB002', CODIGO_RUBRO:'1', CODIGO_TEMPORADA:'VE', CODIGO_ANO:'27', TOTAL_PARES:6, TOTAL_PEDIDO:5000, MONEDA:'ARS' },
    { ID_PEDIDO:3, ESTADO:'ANULADO', CODIGO_RUBRO:'1', CODIGO_TEMPORADA:'VE', CODIGO_ANO:'27', TOTAL_PARES:9, TOTAL_PEDIDO:50, MONEDA:'USD' },
  ];
  repository.obtenerAltasPorPedido = async () => [];
  const accesoTotal = { todasMarcas:true, todosRubros:true, todasLicencias:true };
  try {
    assert.deepEqual((await service.generarReportePedidos(1, accesoTotal, { estado:'VALIDADO' })).map(x => x.ID_PEDIDO), [1]);
    assert.deepEqual((await service.generarReportePedidos(1, accesoTotal, { estado:'BORRADOR' })).map(x => x.ID_PEDIDO), [2]);
    assert.deepEqual((await service.generarReportePedidos(1, accesoTotal, { estado:'AMBOS' })).map(x => x.ID_PEDIDO), [1,2]);
    assert.deepEqual((await service.generarReportePedidos(1, accesoTotal, { estado:'AMBOS', proveedor:'PB002' })).map(x => x.ID_PEDIDO), [2]);
  } finally {
    repository.listarPedidos = original;
    repository.obtenerAltasPorPedido = altasOriginal;
  }
});

test('Pedidos incorpora la sección de reportes con filtros y totales de pares y dinero', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/reportes.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/pedidos-reportes.js'), 'utf8');
  assert.match(vista, /reporteEstado/);
  assert.match(vista, /Validados[\s\S]*Borradores[\s\S]*Ambos/);
  assert.match(vista, /reporteRubro/);
  assert.match(vista, /reporteTemporada/);
  assert.match(vista, /reporteAno/);
  assert.match(vista, /reporteProveedor/);
  assert.match(vista, /exportarReporteExcel/);
  assert.match(vista, /Cantidad de pares/);
  assert.match(vista, /Cantidad de dinero/);
  assert.match(cliente, /api\/pedidos\/reportes\/resumen/);
  assert.match(cliente, /const monedas = new Map/);
});

test('el detalle por temporada informa producto, precio, cantidad, P por Q y foto', async () => {
  const listarOriginal = repository.listarPedidos;
  const altasOriginal = repository.obtenerAltasPorPedido;
  const detalleOriginal = repository.listarDetallePedido;
  repository.listarPedidos = async () => [{ ID_PEDIDO:1, ESTADO:'VALIDADO', TOTAL_PARES:12, TOTAL_PEDIDO:120, MONEDA:'USD', DETALLE_PROVEEDOR:'PROVEEDOR', NUMERO_ORDEN:'OC-1', CODIGO_TEMPORADA:'VE', CODIGO_ANO:'27' }];
  repository.obtenerAltasPorPedido = async () => [];
  repository.listarDetallePedido = async () => [{ ID_ALTA:2, TIPO_PRODUCTO:'MODULO', DETALLE_MODELO:'MODELO', DETALLE_COLOR:'ROJO', DETALLE_MODULO:'35 AL 40', PRECIO_FOB_PAR:10, CANTIDAD_PARES:12, TOTAL_FOB:120, CODIGO_ANO:'27', CODIGO_TEMPORADA:'VE', CODIGO_MODELO:'M1', CODIGO_COLOR:'R1' }];
  try {
    const filas = await service.generarReporteDetallePedidos(1, { todasMarcas:true, todosRubros:true, todasLicencias:true }, { estado:'VALIDADO' });
    assert.equal(filas[0].PRECIO_UNITARIO, 10);
    assert.equal(filas[0].CANTIDAD, 12);
    assert.equal(filas[0].PRECIO_POR_CANTIDAD, 120);
    assert.match(filas[0].URL_IMAGEN, /api\/imagenes\/archivo/);
  } finally {
    repository.listarPedidos = listarOriginal;
    repository.obtenerAltasPorPedido = altasOriginal;
    repository.listarDetallePedido = detalleOriginal;
  }
  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/reportes.hbs'), 'utf8');
  assert.match(vista, /Detalle por temporada/);
  assert.match(vista, /Precio unitario[\s\S]*Cantidad[\s\S]*P × Q/);
  assert.match(vista, /reporteDetalleTabla/);
});

test('ambos reportes se exportan a Excel respetando el proveedor seleccionado', async () => {
  const listarOriginal = repository.listarPedidos;
  const altasOriginal = repository.obtenerAltasPorPedido;
  const detalleOriginal = repository.listarDetallePedido;
  repository.listarPedidos = async () => [
    { ID_PEDIDO:1, ESTADO:'VALIDADO', CODIGO_PROVEEDOR:'PB001', DETALLE_PROVEEDOR:'UNO', NUMERO_ORDEN:'OC-1', TOTAL_PARES:12, TOTAL_PEDIDO:120, MONEDA:'USD', CODIGO_RUBRO:'CAL', CODIGO_TEMPORADA:'VE', CODIGO_ANO:'27' },
    { ID_PEDIDO:2, ESTADO:'VALIDADO', CODIGO_PROVEEDOR:'PB002', DETALLE_PROVEEDOR:'DOS', NUMERO_ORDEN:'OC-2', TOTAL_PARES:6, TOTAL_PEDIDO:60, MONEDA:'USD', CODIGO_RUBRO:'CAL', CODIGO_TEMPORADA:'VE', CODIGO_ANO:'27' },
  ];
  repository.obtenerAltasPorPedido = async () => [];
  repository.listarDetallePedido = async id => [{ ID_ALTA:99, TIPO_PRODUCTO:'PAR_SUELTO', DETALLE_MODELO:`MODELO ${id}`, DETALLE_COLOR:'NEGRO', DETALLE_TALLE:'40', PRECIO_FOB_PAR:10, CANTIDAD_PARES:6, TOTAL_FOB:60, CODIGO_MODELO:'M1', CODIGO_COLOR:'N1' }];
  const acceso = { todasMarcas:true, todosRubros:true, todasLicencias:true };
  try {
    const resumen = await service.exportarReportePedidos(1, acceso, { tipo:'resumen', estado:'AMBOS', proveedor:'PB002' });
    const libroResumen = new ExcelJS.Workbook();
    await libroResumen.xlsx.load(resumen.buffer);
    assert.equal(libroResumen.worksheets[0].rowCount, 2);
    assert.equal(libroResumen.worksheets[0].getCell('A2').value, 'DOS');

    const detalle = await service.exportarReportePedidos(1, acceso, { tipo:'detalle', estado:'AMBOS', proveedor:'PB001' });
    const libroDetalle = new ExcelJS.Workbook();
    await libroDetalle.xlsx.load(detalle.buffer);
    assert.equal(libroDetalle.worksheets[0].getCell('B2').value, 'UNO');
    assert.equal(libroDetalle.worksheets[0].getCell('H2').value, 6);
  } finally {
    repository.listarPedidos = listarOriginal;
    repository.obtenerAltasPorPedido = altasOriginal;
    repository.listarDetallePedido = detalleOriginal;
  }
});

test('los reportes se gestionan mediante un permiso explícito por empresa', () => {
  let continuo = false;
  authMiddleware.requerirReportesEmpresa(
    { usuario:{}, accesoEmpresa:{ rol:'OPERADOR', puedeVerReportes:true } },
    {},
    () => { continuo = true; }
  );
  assert.equal(continuo, true);
  let respuesta;
  authMiddleware.requerirReportesEmpresa(
    { usuario:{}, accesoEmpresa:{ rol:'ADMIN', puedeVerReportes:false } },
    { status(codigo) { respuesta = { codigo }; return { json(datos) { respuesta.datos = datos; } }; } },
    () => assert.fail('No debe permitir continuar')
  );
  assert.equal(respuesta.codigo, 403);
  const navbar = fs.readFileSync(path.join(__dirname, '../views/partials/navbar.hbs'), 'utf8');
  const navbarJs = fs.readFileSync(path.join(__dirname, '../public/js/navbar-session.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(__dirname, '../src/routes/pedidos.routes.js'), 'utf8');
  const usuarios = fs.readFileSync(path.join(__dirname, '../public/js/usuarios-admin-v2f.js'), 'utf8');
  const usuariosRepository = fs.readFileSync(path.join(__dirname, '../src/repositories/usuarios.repository.js'), 'utf8');
  const migracion = fs.readFileSync(path.join(__dirname, '../sql/24_permiso_reportes_usuarios.sql'), 'utf8');
  assert.match(navbar, /id="navReportes"[\s\S]*href="\/pedidos\/reportes"/);
  assert.match(navbarJs, /acceso\?\.puedeVerReportes === true/);
  assert.match(navbarJs, /!acceso[\s\S]*item\?\.puedeVerReportes === true/);
  assert.match(usuarios, /permiso-ver-reportes/);
  assert.match(usuariosRepository, /PUEDE_VER_REPORTES/);
  assert.match(usuariosRepository, /SESION_VERSION = ISNULL\(SESION_VERSION, 1\) \+ 1/);
  assert.match(migracion, /PUEDE_VER_REPORTES/);
  assert.match(rutas, /reportes\/resumen', requerirEmpresa, requerirReportesEmpresa/);
});
