const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el listado de Altas permite encontrar en qué Alta aparece un producto', () => {
  const repo = fs.readFileSync(path.join(__dirname, '../src/repositories/altas.repository.js'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/altas-index.js'), 'utf8');
  const vista = fs.readFileSync(path.join(__dirname, '../views/altas/index.hbs'), 'utf8');

  assert.match(repo, /AS PRODUCTOS_BUSQUEDA/);
  assert.match(repo, /DB\.CODIGO_ALFA/);
  assert.match(repo, /DB\.DETALLE_MODELO/);
  assert.match(repo, /DB\.DETALLE_COLOR/);
  assert.match(cliente, /item\.PRODUCTOS_BUSQUEDA/);
  assert.match(vista, /Buscar alta o producto: código, modelo, color/);
});
