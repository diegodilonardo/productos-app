const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el Alta permite seleccionar y eliminar varias familias principales', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/altas/productos.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/alta-productos.js'), 'utf8');
  assert.match(vista, /id="seleccionarTodasFamilias"/);
  assert.match(vista, /id="btnEliminarFamiliasSeleccionadas"/);
  assert.match(cliente, /class="form-check-input seleccionar-familia"/);
  assert.match(cliente, /async function eliminarFamiliasSeleccionadas/);
  assert.match(cliente, /for \(const idDetalle of ids\)[\s\S]*method: 'DELETE'/);
  assert.match(cliente, /estadoAlta\(\) !== 'BORRADOR'/);
});
