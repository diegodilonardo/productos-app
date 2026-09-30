const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');
const altasRepository = require('../src/repositories/altas.repository');
const pedidosService = require('../src/services/pedidos.service');
const pedidosRepository = require('../src/repositories/pedidos.repository');
const authMiddleware = require('../src/middlewares/auth.middleware');

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

test('un operador puede abrir un Alta vacía y la licencia se controla al quedar definida', async t => {
  const accesoTalleres = {
    todasMarcas: false,
    todosRubros: false,
    todasLicencias: false,
    marcas: [{ codigoMarca: '1' }],
    rubros: [{ codigoRubro: '3' }],
    licencias: ['TALLERES']
  };
  const altaBase = { CODIGO_MARCA: '1', CODIGO_RUBRO: '3' };

  assert.equal(authMiddleware.accesoPermiteAlta(accesoTalleres, { ...altaBase, LICENCIA_ALTA: null }), true);
  assert.equal(authMiddleware.accesoPermiteAlta(accesoTalleres, { ...altaBase, LICENCIA_ALTA: 'TALLERES' }), true);
  assert.equal(authMiddleware.accesoPermiteAlta(accesoTalleres, { ...altaBase, LICENCIA_ALTA: 'SIN LICENCIA' }), false);

  const original = altasRepository.listarAltas;
  t.after(() => { altasRepository.listarAltas = original; });
  altasRepository.listarAltas = async () => [
    { ID_ALTA: 10, ...altaBase, LICENCIA_ALTA: null },
    { ID_ALTA: 11, ...altaBase, LICENCIA_ALTA: 'TALLERES' },
    { ID_ALTA: 12, ...altaBase, LICENCIA_ALTA: 'SIN LICENCIA' }
  ];

  const visibles = await altasService.listarAltas(1, accesoTalleres);
  assert.deepEqual(visibles.map(alta => alta.ID_ALTA), [10, 11]);
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
