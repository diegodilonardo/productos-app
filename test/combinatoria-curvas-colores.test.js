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
