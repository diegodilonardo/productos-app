const test = require('node:test');
const assert = require('node:assert/strict');
const reglas = require('../public/js/reglas-talles-par-suelto');

const talles = [
  ['T35', '35'], ['T385', '38.5'], ['T39', '39'],
  ['T_XS', 'XS'], ['T_M', 'M'], ['T_2XL', '2XL'], ['T_3XL', '3XL'],
  ['T00', '00'], ['T01', '01'], ['T02', '02']
].map(([CODIGO_TALLE, DETALLE_TALLE]) => ({ CODIGO_TALLE, DETALLE_TALLE }));

const codigos = lista => lista.map(item => item.CODIGO_TALLE);

test('CALZADO incluye talles numéricos y medios talles en orden', () => {
  assert.deepEqual(codigos(reglas.filtrar(talles, 'CALZADO')), ['T01', 'T02', 'T35', 'T385', 'T39']);
});

test('CALZADO excluye talles alfabéticos de indumentaria y el talle 00', () => {
  const resultado = codigos(reglas.filtrar(talles, 'calzado'));
  assert.equal(resultado.includes('T_2XL'), false);
  assert.equal(resultado.includes('T_3XL'), false);
  assert.equal(resultado.includes('T00'), false);
});

test('INDUMENTARIA conserva los códigos reales XL, 2XL y 3XL', () => {
  assert.deepEqual(codigos(reglas.filtrar(talles, 'INDUMENTARIA')), ['T_XS', 'T_M', 'T_2XL', 'T_3XL']);
});

test('ACCESORIOS y POP respetan sus conjuntos habilitados', () => {
  assert.deepEqual(codigos(reglas.filtrar(talles, 'ACCESORIOS')), ['T00', 'T01', 'T02']);
  assert.deepEqual(codigos(reglas.filtrar(talles, 'POP')), ['T00']);
});

test('un rubro desconocido no expone talles indiscriminadamente', () => {
  assert.deepEqual(reglas.filtrar(talles, 'OTRO'), []);
});
