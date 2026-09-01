const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');

const { normalizarTextoLimitado } = altasService._internals;

test('los campos adicionales opcionales se normalizan a NULL', () => {
  assert.equal(normalizarTextoLimitado(undefined, 'CO_NEW', 50), null);
  assert.equal(normalizarTextoLimitado('   ', 'MUESTRA', 50), null);
});

test('los campos adicionales conservan texto válido sin espacios externos', () => {
  assert.equal(
    normalizarTextoLimitado('  Cuero sintético  ', 'MATERIAL_CALZADO', 100),
    'Cuero sintético'
  );
});

test('el backend rechaza campos adicionales que exceden su largo', () => {
  assert.throws(
    () => normalizarTextoLimitado('x'.repeat(51), 'CO_NEW', 50),
    /CO_NEW no puede superar los 50 caracteres/
  );
  assert.throws(
    () => normalizarTextoLimitado('x'.repeat(501), 'DESCRIPCION', 500),
    /DESCRIPCION no puede superar los 500 caracteres/
  );
});
