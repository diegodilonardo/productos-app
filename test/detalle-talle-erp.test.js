const test = require('node:test');
const assert = require('node:assert/strict');
const { obtenerDetalleTalleERP } = require('../src/services/exportacion.service');

test('compacta curvas agrupadas de cualquier empresa sin superar DTALLC', () => {
  const resultado = obtenerDetalleTalleERP('MODULO', {
    DETALLE_MODULO: '36/37 38/39 40/41 42/43 44/45 X12 1,2,3,4,2',
  });

  assert.equal(resultado, '36/37 AL 44/45 X12 (1,2,3,4,2)');
  assert.ok(resultado.length <= 40);
});

test('mantiene sin cambios las curvas que ya entran en DTALLC', () => {
  assert.equal(
    obtenerDetalleTalleERP('MODULO', { DETALLE_MODULO: '35 AL 40 X 12 1,2,3,3,2,1' }),
    '35 AL 40 X12 1,2,3,3,2,1',
  );
});

test('no modifica el talle de los pares sueltos', () => {
  assert.equal(
    obtenerDetalleTalleERP('PAR_SUELTO', { DETALLE_TALLE: '36/37' }),
    '36/37',
  );
});
