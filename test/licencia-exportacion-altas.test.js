const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  normalizarLicenciaExportacion,
} = require('../src/services/exportacion.service');

test('toda Alta sin licencia se exporta como SIN LICENCIA', () => {
  for (const valor of [null, undefined, '', '   ', '__SIN_LICENCIA__']) {
    assert.equal(normalizarLicenciaExportacion(valor), 'SIN LICENCIA');
  }
});

test('una licencia informada conserva su descripción', () => {
  assert.equal(normalizarLicenciaExportacion('  SAN LORENZO  '), 'SAN LORENZO');
});

test('la regla se aplica a PRODUCTOS y MODELOS sin depender de la empresa', () => {
  const fuente = fs.readFileSync('src/services/exportacion.service.js', 'utf8');
  assert.equal(
    (fuente.match(/LICENCIAS: normalizarLicenciaExportacion\(detalle\.LICENCIA\)/g) || []).length,
    2
  );
  assert.doesNotMatch(fuente, /normalizarLicenciaExportacion\([^)]*ID_EMPRESA/);
});
