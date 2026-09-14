const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Altas informa productos inhabilitados en tarjetas y detalle histórico', () => {
  const repositorio = fs.readFileSync(path.join(__dirname, '../src/repositories/altas.repository.js'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/altas-index.js'), 'utf8');
  assert.match(repositorio, /CANTIDAD_PRODUCTOS_INHABILITADOS/);
  assert.match(repositorio, /INHABILITADO_PRESEA/);
  assert.match(cliente, /producto\$\{inhabilitados === 1 \? '' : 's'\} inhabilitado/);
  assert.match(cliente, /INHABILITADO/);
});

test('Pedidos conserva y señala productos que fueron inhabilitados posteriormente', () => {
  const repositorio = fs.readFileSync(path.join(__dirname, '../src/repositories/pedidos.repository.js'), 'utf8');
  const listado = fs.readFileSync(path.join(__dirname, '../public/js/pedidos-index.js'), 'utf8');
  const detalle = fs.readFileSync(path.join(__dirname, '../public/js/pedido-detalle.js'), 'utf8');
  assert.match(repositorio, /CANTIDAD_PRODUCTOS_INHABILITADOS/);
  assert.match(repositorio, /PR\.C_ESTADIO/);
  assert.match(listado, /productosInhabilitados|CANTIDAD_PRODUCTOS_INHABILITADOS/);
  assert.match(detalle, /pintarDetalleConEstadoPresea/);
  assert.match(detalle, /INHABILITADO/);
});
