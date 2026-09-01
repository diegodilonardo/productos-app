const test = require('node:test');
const assert = require('node:assert/strict');

const altasService = require('../src/services/altas.service');

const determinar = altasService._internals.determinarRubroFact;

test('MARCEL utiliza las reglas confirmadas de GYD', () => {
  assert.equal(determinar('MARCEL', 'CALZADO', null, 'MODULO'), 'MOD_CALZ_MAR');
  assert.equal(determinar('MARCEL', 'CALZADO', null, 'PAR_SUELTO'), 'CALZ_MAR');
  assert.equal(determinar('MARCEL', 'ACCESORIOS', null, 'MODULO'), 'MOD_PACK_MAR');
  assert.equal(determinar('MARCEL', 'ACCESORIOS', null, 'PAR_SUELTO'), 'ACCE_MAR');
  assert.equal(determinar('MARCEL', 'POP', null, 'PAR_SUELTO'), 'POP_MAR');
});

test('MASSIMO utiliza únicamente las combinaciones presentes en su maestro', () => {
  assert.equal(determinar('MASSIMO', 'CALZADO', null, 'MODULO'), 'MOD_CALZ_MAS');
  assert.equal(determinar('MASSIMO', 'CALZADO', null, 'PAR_SUELTO'), 'CALZ_MAS');
  assert.equal(determinar('MASSIMO', 'ACCESORIOS', null, 'PAR_SUELTO'), 'ACCE_MAS');
  assert.equal(determinar('MASSIMO', 'POP', null, 'PAR_SUELTO'), 'POP_MAS');
  assert.throws(() => determinar('MASSIMO', 'POP', null, 'MODULO'), /No existe regla/);
});

test('WAKE utiliza las reglas confirmadas de calzado, licencias y POP', () => {
  assert.equal(determinar('WAKE', 'CALZADO', null, 'MODULO'), 'MOD_CALZ_WK');
  assert.equal(determinar('WAKE', 'CALZADO', null, 'PAR_SUELTO'), 'CALZ_WK');
  assert.equal(determinar('WAKE', 'LICENCIAS', null, 'MODULO'), 'MOD_LICE_WK');
  assert.equal(determinar('WAKE', 'LICENCIAS', null, 'PAR_SUELTO'), 'LICE_WK');
  assert.equal(determinar('WAKE', 'POP', null, 'PAR_SUELTO'), 'POP_WK');
});

test('MASSIMO_HOMBRE queda fuera del circuito comercial', () => {
  assert.throws(
    () => determinar('MASSIMO_HOMBRE', 'CALZADO', null, 'MODULO'),
    /No existe regla/
  );
});

test('INDUMENTARIA queda bloqueada porque GYD no informó RUBRO_FACT', () => {
  assert.throws(
    () => determinar('MARCEL', 'INDUMENTARIA', null, 'MODULO'),
    /No existe regla/
  );
});
