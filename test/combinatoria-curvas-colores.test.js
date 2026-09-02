const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const altasService = require('../src/services/altas.service');

const { expandirCombinatoriaCurvas } = altasService._internals;

test('múltiples curvas se expanden en solicitudes que conservan todos los colores', () => {
  const entrada = {
    codigoModelo: 'ABC123',
    codigosColor: ['01', '02', '03'],
    codigosModulo: ['C1', 'C2', 'C1', ''],
    codigoProveedor: 'PB0001',
    usuario: 'PRUEBA',
  };

  const resultado = expandirCombinatoriaCurvas(entrada);

  assert.equal(resultado.productos.length, 2);
  assert.deepEqual(
    resultado.productos.map(item => item.codigoModulo),
    ['C1', 'C2']
  );
  assert.deepEqual(resultado.productos[0].codigosColor, ['01', '02', '03']);
  assert.deepEqual(resultado.productos[1].codigosColor, ['01', '02', '03']);
  assert.equal(
    resultado.productos.length * resultado.productos[0].codigosColor.length,
    6
  );
});

test('la combinatoria rechaza una selección de curvas vacía', () => {
  assert.throws(
    () => expandirCombinatoriaCurvas({ codigosModulo: [' ', null] }),
    /al menos una curva/
  );
});

test('cada curva seleccionada se puede quitar desde su chip', () => {
  const fuente = fs.readFileSync(
    path.resolve(__dirname, '../public/js/alta-productos.js'),
    'utf8'
  );

  assert.match(fuente, /modulosSeleccionadosChips/);
  assert.match(fuente, /`Quitar curva \$\{textoModulo\}`/);
  assert.match(
    fuente,
    /codigosModulosSeleccionados\.filter\(\s*codigo => codigo !== codigoModulo/
  );
});

test('varios talles de PAR_SUELTO se expanden en una sola operación', () => {
  const entrada = {
    codigoModelo: 'ABC123',
    codigosTalle: ['03', '04', '03'],
    codigosColor: ['10', '20'],
    usuario: 'OPERADOR'
  };

  const resultado = expandirCombinatoriaCurvas(entrada);

  assert.equal(resultado.productos.length, 2);
  assert.deepEqual(
    resultado.productos.map(item => item.codigoTalle),
    ['03', '04']
  );
  assert.deepEqual(resultado.productos[0].codigosColor, ['10', '20']);
  assert.equal(resultado.productos[0].codigoModelo, 'ABC123');
});

test('la combinatoria rechaza una selección de talles vacía', () => {
  assert.throws(
    () => expandirCombinatoriaCurvas({ codigosTalle: [' ', null] }),
    /al menos un talle/
  );
});

test('la combinatoria rechaza mezclar curvas y talles', () => {
  assert.throws(
    () => expandirCombinatoriaCurvas({ codigosModulo: ['A'], codigosTalle: ['1'] }),
    /No se pueden combinar curvas y talles/
  );
});
