const test = require('node:test');
const assert = require('node:assert/strict');

const {
  marcaEtiquetaModulo,
} = require('../src/services/seguimiento.service');

test('la etiqueta de módulo fuerza VANTEK por su código de marca', () => {
  assert.equal(
    marcaEtiquetaModulo({ CODIGO_MARCA: '80', DETALLE_MARCA: 'MONTAGNE' }),
    'VANTEK'
  );
});

test('la etiqueta de módulo fuerza 47 STREET por su código de marca', () => {
  assert.equal(
    marcaEtiquetaModulo({ CODIGO_MARCA: '47', DETALLE_MARCA: 'MONTAGNE' }),
    '47 STREET'
  );
});

test('las demás marcas mantienen su descripción habitual', () => {
  assert.equal(
    marcaEtiquetaModulo({ CODIGO_MARCA: '10', DETALLE_MARCA: 'MONTAGNE' }),
    'MONTAGNE'
  );
});
