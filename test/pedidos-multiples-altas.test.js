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
