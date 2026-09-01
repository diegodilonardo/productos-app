const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');

const normalizar =
  altasService._internals.normalizarCodigoModeloCodigoAlfa;

test('GYD completa a 6 posiciones sus modelos de 5 caracteres', () => {
  for (const marca of ['MASSIMO', 'WAKE', 'MARCEL']) {
    assert.equal(normalizar(marca, 'A1234'), '0A1234');
  }
});

test('GYD conserva sin cambios sus modelos de 6 caracteres', () => {
  for (const marca of ['MASSIMO', 'WAKE', 'MARCEL']) {
    assert.equal(normalizar(marca, 'A12345'), 'A12345');
  }
});

test('la normalización variable conserva la regla de MONTAGNE', () => {
  assert.equal(normalizar('MONTAGNE', 'MT062'), '0MT062');
});
