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
  const vista = leer('views/altas/index.hbs');

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
  assert.match(vista, /id="filtroEanAlta"/);
  assert.match(vista, /id="opcionesFiltroEanAlta"/);
  assert.match(cliente, /ean:\s*new Set\(\)/);
  assert.match(cliente, /filtrosMultiplesAltas\.ean\.size/);
  assert.match(cliente, /EAN_COMPLETOS/);
  assert.match(cliente, /EAN_PARCIALES/);
  assert.match(cliente, /EAN_NO_REQUERIDO/);
  assert.match(cliente, /SIN_DATOS_EAN/);
  assert.match(vista, /id="filtroFotosAlta"/);
  assert.match(vista, /id="opcionesFiltroFotosAlta"/);
  assert.match(cliente, /fotos:\s*new Set\(\)/);
  assert.match(cliente, /filtrosMultiplesAltas\.fotos\.size/);
  assert.match(cliente, /FOTOS_EN_PRESEA/);
  assert.match(cliente, /FOTOS_PENDIENTES/);
});
