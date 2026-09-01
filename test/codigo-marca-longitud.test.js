const test = require('node:test');
const assert = require('node:assert/strict');

const { maestros } = require('../src/config/masters');

test('el maestro de marcas admite códigos de hasta 5 caracteres', () => {
  const columna = maestros.MARCAS.columnas.find(
    item => item.nombre === 'CODIGO_MARCA'
  );

  assert.ok(columna);
  assert.equal(columna.longitud, 5);
});
