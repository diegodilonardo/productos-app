const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function leer(ruta) {
  return fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8');
}

test('las tarjetas resumen la cobertura EAN definitiva sin contar el código genérico', () => {
  const repositorio = leer('src/repositories/altas.repository.js');
  const cliente = leer('public/js/altas-index.js');

  assert.match(repositorio, /7792800015157/);
  assert.match(repositorio, /CANTIDAD_EAN_EVALUADOS/);
  assert.match(repositorio, /CANTIDAD_EAN_REQUERIDOS/);
  assert.match(repositorio, /CANTIDAD_EAN_DEFINITIVOS/);
  assert.match(repositorio, /REGLAS_REQUERIMIENTO_EAN/);
  assert.match(cliente, /EAN COMPLETOS/);
  assert.match(cliente, /EAN PARCIALES/);
  assert.match(cliente, /SIN EAN/);
  assert.match(cliente, /EAN NO REQUERIDO/);
  assert.match(cliente, /\$\{badgeEan\}/);
});
