const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');
const altasRepository = require('../src/repositories/altas.repository');
const pedidosService = require('../src/services/pedidos.service');
const pedidosRepository = require('../src/repositories/pedidos.repository');

const accesoLimitado = {
  todasMarcas: false,
  todosRubros: false,
  todasLicencias: false,
  marcas: [{ codigoMarca: '1', detalleMarca: 'ATOMIK' }],
  rubros: [
    { codigoRubro: '2', detalleRubro: 'INDUMENTARIA' },
    { codigoRubro: '3', detalleRubro: 'ACCESORIOS' }
  ],
  licencias: ['SIN LICENCIA']
};

test('las tarjetas de Altas respetan marca, rubro y licencia del usuario', async t => {
  const original = altasRepository.listarAltas;
  t.after(() => { altasRepository.listarAltas = original; });
  altasRepository.listarAltas = async () => [
    { ID_ALTA: 1, CODIGO_MARCA: '1', DETALLE_MARCA: 'ATOMIK', CODIGO_RUBRO: '2', DETALLE_RUBRO: 'INDUMENTARIA', LICENCIA_ALTA: 'SIN LICENCIA' },
    { ID_ALTA: 2, CODIGO_MARCA: '1', DETALLE_MARCA: 'ATOMIK', CODIGO_RUBRO: '3', DETALLE_RUBRO: 'ACCESORIOS', LICENCIA_ALTA: 'SIN LICENCIA' },
    { ID_ALTA: 3, CODIGO_MARCA: '1', DETALLE_MARCA: 'ATOMIK', CODIGO_RUBRO: '1', DETALLE_RUBRO: 'CALZADO', LICENCIA_ALTA: 'SIN LICENCIA' },
    { ID_ALTA: 4, CODIGO_MARCA: '1', DETALLE_MARCA: 'ATOMIK', CODIGO_RUBRO: '2', DETALLE_RUBRO: 'INDUMENTARIA', LICENCIA_ALTA: 'DISNEY' }
  ];

  const visibles = await altasService.listarAltas(1, accesoLimitado);
  assert.deepEqual(visibles.map(alta => alta.ID_ALTA), [1, 2]);
});

test('un Pedido con múltiples Altas se oculta si alguna queda fuera del alcance', async t => {
  const originales = {
    listarPedidos: pedidosRepository.listarPedidos,
    obtenerAltasPorPedido: pedidosRepository.obtenerAltasPorPedido
  };
  t.after(() => Object.assign(pedidosRepository, originales));

  pedidosRepository.listarPedidos = async () => [
    { ID_PEDIDO: 10, ID_EMPRESA: 1, CODIGO_MARCA: '1', CODIGO_RUBRO: '2', LICENCIA_ALTA: 'SIN LICENCIA' },
    { ID_PEDIDO: 11, ID_EMPRESA: 1, CODIGO_MARCA: '1', CODIGO_RUBRO: '2', LICENCIA_ALTA: 'SIN LICENCIA' }
  ];
  pedidosRepository.obtenerAltasPorPedido = async idPedido => idPedido === 10
    ? [
        { CODIGO_MARCA: '1', CODIGO_RUBRO: '2', LICENCIA_ALTA: 'SIN LICENCIA' },
        { CODIGO_MARCA: '1', CODIGO_RUBRO: '3', LICENCIA_ALTA: 'SIN LICENCIA' }
      ]
    : [
        { CODIGO_MARCA: '1', CODIGO_RUBRO: '2', LICENCIA_ALTA: 'SIN LICENCIA' },
        { CODIGO_MARCA: '1', CODIGO_RUBRO: '1', LICENCIA_ALTA: 'SIN LICENCIA' }
      ];

  const visibles = await pedidosService.listarPedidos(1, accesoLimitado);
  assert.deepEqual(visibles.map(pedido => pedido.ID_PEDIDO), [10]);
});
