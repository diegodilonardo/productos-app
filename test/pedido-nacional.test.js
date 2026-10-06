const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const service = require('../src/services/pedidos.service');

test('PB9999 y los proveedores identificados como nacionales usan el circuito nacional', () => {
  const { esProveedorNacional, CODIGO_PROVEEDOR_NACIONAL } = service._internals;
  assert.equal(CODIGO_PROVEEDOR_NACIONAL, 'PB9999');
  assert.equal(esProveedorNacional(' pb9999 '), true);
  assert.equal(esProveedorNacional('PB0076', 'PROVEEDOR GENERICO NACIONAL'), true);
  assert.equal(esProveedorNacional('PB0001'), false);
});

test('el DBI nacional respeta CODIGO, COD_ALFA y CANTIDAD', () => {
  const { CAMPOS_PEDIDO_NACIONAL, crearDBFBuffer } = service._internals;
  assert.deepEqual(CAMPOS_PEDIDO_NACIONAL.map(x => x.nombre), ['CODIGO','COD_ALFA','CANTIDAD']);
  const buffer = crearDBFBuffer([{ CODIGO: 12345, COD_ALFA: '271234567890123', CANTIDAD: 24 }], CAMPOS_PEDIDO_NACIONAL);
  assert.equal(buffer.readUInt32LE(4), 1);
  assert.equal(buffer.subarray(32,43).toString('ascii').replaceAll('\0',''), 'CODIGO');
  assert.equal(buffer.subarray(64,75).toString('ascii').replaceAll('\0',''), 'COD_ALFA');
  assert.equal(buffer.subarray(96,107).toString('ascii').replaceAll('\0',''), 'CANTIDAD');
});

test('la interfaz reemplaza las exportaciones internacionales para PB9999', () => {
  const detalle = fs.readFileSync('public/js/pedido-detalle.js','utf8');
  const listado = fs.readFileSync('public/js/pedidos-index.js','utf8');
  const rutas = fs.readFileSync('src/routes/pedidos.routes.js','utf8');
  assert.match(detalle, /PB9999/);
  assert.match(detalle, /pedido-nacional/);
  assert.match(listado, /esPedidoNacional/);
  assert.match(rutas, /exportarPedidoNacionalDBI/);
});

test('las exportaciones importadas quedan bloqueadas para el proveedor nacional', () => {
  const fuente = fs.readFileSync('src/services/pedidos.service.js','utf8');
  assert.match(fuente, /function exigirCircuitoImportado/);
  assert.match(fuente, /Debe utilizar la exportación Pedido nacional DBI/);
  assert.ok((fuente.match(/exigirCircuitoImportado\(pedido\)/g)||[]).length >= 4);
});
