const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el detalle del Alta permite filtrar familias con y sin foto', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'views', 'altas', 'productos.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'alta-productos.js'), 'utf8');

  assert.match(vista, /id="filtroProductosImagen"/);
  assert.match(vista, /value="CON_FOTO">Con foto/);
  assert.match(vista, /value="SIN_FOTO">Sin foto/);
  assert.match(cliente, /actualizarFiltroImagenFamilia\(fila, 'CON_FOTO'\)/);
  assert.match(cliente, /actualizarFiltroImagenFamilia\(fila, 'SIN_FOTO'\)/);
  assert.match(cliente, /fila\.dataset\.filtroImagen === filtros\.imagen/);
  assert.match(cliente, /'filtroProductosImagen'/);
});
