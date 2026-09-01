const test = require('node:test');
const assert = require('node:assert/strict');

const pedidosRepository = require('../src/repositories/pedidos.repository');
const pedidosService = require('../src/services/pedidos.service');

test('el detalle del pedido reconstruye la imagen desde el Alta y el producto', async () => {
  const obtenerPedidoOriginal = pedidosRepository.obtenerPedidoPorId;
  const listarDetalleOriginal = pedidosRepository.listarDetallePedido;

  pedidosRepository.obtenerPedidoPorId = async () => ({
    ID_PEDIDO: 1,
    ID_EMPRESA: 2,
    CODIGO_ANO: '27',
    CODIGO_TEMPORADA: 'VE',
  });
  pedidosRepository.listarDetallePedido = async () => [{
    ID_PEDIDO_DETALLE: 10,
    TIPO_PRODUCTO: 'MODULO',
    CODIGO_MODELO: '123456',
    CODIGO_COLOR: '08',
    DETALLE_MODULO: '35 AL 40 X 12',
  }];

  try {
    const detalle = await pedidosService.listarDetallePedido(1, 2);

    assert.equal(detalle.length, 1);
    assert.equal(detalle[0].TALLE_CURVA, '35 AL 40 X 12');
    assert.equal(
      detalle[0].URL_IMAGEN,
      '/api/imagenes/archivo?ano=27&temporada=VE&modelo=123456&color=08'
    );
  } finally {
    pedidosRepository.obtenerPedidoPorId = obtenerPedidoOriginal;
    pedidosRepository.listarDetallePedido = listarDetalleOriginal;
  }
});
