const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pedidosService = require('../src/services/pedidos.service');
const pedidosRepository = require('../src/repositories/pedidos.repository');

const accesoTotal = {
  todasMarcas: true,
  todosRubros: true,
  todasLicencias: true
};

test('la cabecera conserva todas las Altas seleccionadas y un único proveedor', async t => {
  const originales = {
    obtenerAltaDisponiblePorId: pedidosRepository.obtenerAltaDisponiblePorId,
    obtenerProveedoresPorAltas: pedidosRepository.obtenerProveedoresPorAltas
  };
  t.after(() => Object.assign(pedidosRepository, originales));

  pedidosRepository.obtenerAltaDisponiblePorId = async id => ({
    ID_ALTA: Number(id), ID_EMPRESA: 2, CODIGO_ALTA: `ALT-${id}`,
    CODIGO_MARCA: '47', CODIGO_RUBRO: '1', LICENCIA_ALTA: 'SIN LICENCIA',
    TIPO_PRODUCTO: 'MODULO', ESTADO: 'GENERADO_OK_EN_ERP'
  });
  pedidosRepository.obtenerProveedoresPorAltas = async ids => [{
    CODIGO_PROVEEDOR: 'PB001', DETALLE_PROVEEDOR: 'PROVEEDOR',
    CANTIDAD_ALTAS: ids.length
  }];

  const cabecera = await pedidosService.prepararCabeceraPedido({
    idsAltas: [10, 11], codigoProveedor: 'PB001', numeroOrden: '1000', moneda: 'USD'
  }, 2, accesoTotal, 'TEST');

  assert.deepEqual(cabecera.IDS_ALTAS, [10, 11]);
  assert.equal(cabecera.ID_ALTA, 10);
  assert.equal(cabecera.CODIGO_PROVEEDOR, 'PB001');
  assert.equal(cabecera.CODIGO_ALTA, 'ALT-10-MAS-1');
});

test('impide mezclar marcas porque el pedido posee un único destino FTP', async t => {
  const original = pedidosRepository.obtenerAltaDisponiblePorId;
  t.after(() => { pedidosRepository.obtenerAltaDisponiblePorId = original; });
  pedidosRepository.obtenerAltaDisponiblePorId = async id => ({
    ID_ALTA: Number(id), ID_EMPRESA: 2, CODIGO_ALTA: `ALT-${id}`,
    CODIGO_MARCA: Number(id) === 10 ? '47' : '10', CODIGO_RUBRO: '1',
    LICENCIA_ALTA: 'SIN LICENCIA', TIPO_PRODUCTO: 'MODULO',
    ESTADO: 'GENERADO_OK_EN_ERP'
  });

  await assert.rejects(
    pedidosService.prepararCabeceraPedido({
      idsAltas: [10, 11], codigoProveedor: 'PB001', numeroOrden: '1000'
    }, 2, accesoTotal, 'TEST'),
    /misma marca/i
  );
});

test('Nuevo Pedido presenta selección múltiple y envía idsAltas', () => {
  const vista = fs.readFileSync(path.resolve(__dirname, '../views/pedidos/nuevo.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/pedido-nuevo.js'), 'utf8');
  const migracion = fs.readFileSync(path.resolve(__dirname, '../sql/13_pedidos_multiples_altas.sql'), 'utf8');

  assert.match(vista, /id="altasPedidoSelector"/);
  assert.match(frontend, /idsAltas:\s*\[\.\.\.idsAltasSeleccionadas\]/);
  assert.match(frontend, /\/api\/pedidos\/altas\/proveedores/);
  assert.match(migracion, /CREATE TABLE dbo\.PEDIDOS_ALTAS/);
  assert.match(migracion, /PEDIDOS_DETALLE', 'ID_ALTA/);
});

test('un Pedido BORRADOR permite asociar un Alta posterior compatible', async t => {
  const originales = {
    obtenerPedidoPorId: pedidosRepository.obtenerPedidoPorId,
    obtenerAltasPorPedido: pedidosRepository.obtenerAltasPorPedido,
    obtenerAltaDisponiblePorId: pedidosRepository.obtenerAltaDisponiblePorId,
    obtenerProveedoresPorAlta: pedidosRepository.obtenerProveedoresPorAlta,
    asociarAltaPedido: pedidosRepository.asociarAltaPedido
  };
  t.after(() => Object.assign(pedidosRepository, originales));
  let asociada = null;
  pedidosRepository.obtenerPedidoPorId = async () => ({
    ID_PEDIDO: 7, ID_EMPRESA: 2, ID_ALTA: 10, ESTADO: 'BORRADOR',
    CODIGO_MARCA: '47', CODIGO_PROVEEDOR: 'PB001', CODIGO_ALTA: 'ALT-10'
  });
  pedidosRepository.obtenerAltasPorPedido = async () => [{
    ID_ALTA: 10, CODIGO_ALTA: 'ALT-10', CODIGO_MARCA: '47',
    CODIGO_RUBRO: '1', LICENCIA_ALTA: 'SIN LICENCIA'
  }];
  pedidosRepository.obtenerAltaDisponiblePorId = async id => ({
    ID_ALTA: Number(id), ID_EMPRESA: 2, CODIGO_ALTA: 'ALT-11',
    CODIGO_MARCA: '47', CODIGO_RUBRO: '1', LICENCIA_ALTA: 'SIN LICENCIA',
    TIPO_PRODUCTO: 'MODULO', ESTADO: 'GENERADO_OK_EN_ERP'
  });
  pedidosRepository.obtenerProveedoresPorAlta = async () => [{ CODIGO_PROVEEDOR: 'PB001' }];
  pedidosRepository.asociarAltaPedido = async (...args) => { asociada = args; };

  const resultado = await pedidosService.agregarAltaPedido(7, 11, 2, accesoTotal);
  assert.deepEqual(asociada, [7, 11, 2]);
  assert.equal(resultado.ID_PEDIDO, 7);
});

test('la edición del Pedido ofrece agregar Altas sólo mientras permanece BORRADOR', () => {
  const vista = fs.readFileSync(path.resolve(__dirname, '../views/pedidos/detalle.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/pedido-detalle.js'), 'utf8');
  const rutas = fs.readFileSync(path.resolve(__dirname, '../src/routes/pedidos.routes.js'), 'utf8');
  const repositorio = fs.readFileSync(path.resolve(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  assert.match(vista, /id="btnAgregarAltaPedido"/);
  assert.match(vista, /id="modalAgregarAltaPedido"/);
  assert.match(frontend, /estado\(\)!=='BORRADOR'/);
  assert.match(frontend, /\/altas-disponibles/);
  assert.match(frontend, /\/altas`/);
  assert.match(rutas, /router\.post\('\/:id\/altas'/);
  assert.match(repositorio, /ESTADO !== 'BORRADOR'/);
  assert.match(repositorio, /INSERT dbo\.PEDIDOS_ALTAS/);
});

test('permite quitar un Alta asociada sin productos y conserva al menos otra', async t => {
  const originales = {
    obtenerPedidoPorId: pedidosRepository.obtenerPedidoPorId,
    obtenerAltasPorPedido: pedidosRepository.obtenerAltasPorPedido,
    quitarAltaPedido: pedidosRepository.quitarAltaPedido
  };
  t.after(() => Object.assign(pedidosRepository, originales));
  let quitada = null;
  pedidosRepository.obtenerPedidoPorId = async () => ({
    ID_PEDIDO: 7, ID_EMPRESA: 2, ID_ALTA: 10, ESTADO: 'BORRADOR',
    CODIGO_MARCA: '47', CODIGO_PROVEEDOR: 'PB001', CODIGO_ALTA: 'ALT-10'
  });
  pedidosRepository.obtenerAltasPorPedido = async () => [
    { ID_ALTA: 10, CODIGO_ALTA: 'ALT-10' },
    { ID_ALTA: 11, CODIGO_ALTA: 'ALT-11' }
  ];
  pedidosRepository.quitarAltaPedido = async (...args) => { quitada = args; };

  const resultado = await pedidosService.quitarAltaPedido(7, 11, 2);
  assert.deepEqual(quitada, [7, 11, 2]);
  assert.equal(resultado.ID_PEDIDO, 7);

  const repositorio = fs.readFileSync(path.resolve(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  assert.match(repositorio, /PEDIDOS_DETALLE[\s\S]*ID_ALTA=@ID_ALTA/);
  assert.match(repositorio, /productosAlta > 0/);
  assert.match(repositorio, /cantidadAltas <= 1/);
  assert.match(repositorio, /DELETE dbo\.PEDIDOS_ALTAS/);
});

test('la pantalla permite quitar Altas asociadas y explica el control de productos', () => {
  const vista = fs.readFileSync(path.resolve(__dirname, '../views/pedidos/detalle.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/pedido-detalle.js'), 'utf8');
  const rutas = fs.readFileSync(path.resolve(__dirname, '../src/routes/pedidos.routes.js'), 'utf8');
  assert.match(vista, /Gestionar Altas/);
  assert.match(vista, /id="listaAltasAsociadasPedido"/);
  assert.match(frontend, /data-quitar-alta/);
  assert.match(frontend, /si no tiene productos cargados/i);
  assert.match(frontend, /method:'DELETE'/);
  assert.match(rutas, /router\.delete\('\/:id\/altas\/:idAlta'/);
});

test('cada Alta del Pedido permite elegir módulos o productos sueltos', () => {
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/pedido-detalle.js'), 'utf8');
  const rutas = fs.readFileSync(path.resolve(__dirname, '../src/routes/pedidos.routes.js'), 'utf8');
  const repositorio = fs.readFileSync(path.resolve(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  const migracion = fs.readFileSync(path.resolve(__dirname, '../sql/27_modo_seleccion_pedido_alta.sql'), 'utf8');

  assert.match(frontend, /data-modo-alta/);
  assert.match(frontend, /Por módulos/);
  assert.match(frontend, /Por productos sueltos/);
  assert.match(rutas, /router\.patch\('\/:id\/altas\/:idAlta\/modalidad'/);
  assert.match(repositorio, /PA\.MODO_SELECCION = 'MODULO'/);
  assert.match(repositorio, /PA\.MODO_SELECCION = 'PAR_SUELTO'/);
  assert.match(repositorio, /AS CANTIDAD_PRODUCTOS_PEDIDO/);
  assert.match(frontend, /CANTIDAD_PRODUCTOS_PEDIDO/);
  assert.match(repositorio, /cargados > 0/);
  assert.match(migracion, /MODO_SELECCION VARCHAR\(20\)/);
});
